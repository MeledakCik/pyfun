import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUNDLED, fetchSupabaseLessons } from "@/lib/lessons";
import { bodyTooLarge, clientIp, rateLimit } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CROSS_ORIGIN_ERROR, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LESSON_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_NAME = 20;
const MAX_LESSONS = 50;
const MAX_LESSON_XP = 2000;
const MAX_BODY_BYTES = 64 * 1024;

const CUSTOM_NAME_RE = /[<>]/;
const CONTROL_RE = /[\p{Cc}\p{Cf}]/gu;

type RankRow = {
  player_id: string;
  name: string;
  xp: number;
  rank_position: number | string;
  total: number | string;
  is_me: boolean;
};

type BoardEntry = {
  id: string;
  name: string;
  xp: number;
  position: number;
  me: boolean;
};

type Board = {
  entries: BoardEntry[];
  total: number;
  configured: true;
};

type SessionUser = {
  id: string;
  user_metadata?: Record<string, unknown> | null;
};

type PlayerRow = {
  player_id: string;
  name: string;
  custom_name: string | null;
  auth_user_id: string | null;
  secret_hash: string;
  xp: number;
};

type SyncResult =
  | { ok: true; xp: number; gained: number }
  | { ok: false; reason: string };

function errorResponse(message: string, status: number, retryAfter?: number) {
  const headers = new Headers({ "cache-control": "no-store" });
  if (retryAfter) headers.set("retry-after", String(retryAfter));
  return NextResponse.json({ error: message }, { status, headers });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  return name.length > 0 && !CUSTOM_NAME_RE.test(name) && !CONTROL_RE.test(name) ? name : null;
}

function normalizeCustomName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
  if (name.length < 1 || name.length > MAX_NAME) return null;
  if (CUSTOM_NAME_RE.test(name) || CONTROL_RE.test(name)) return null;
  return name;
}

function parseCompletedIds(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_LESSONS) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !LESSON_ID_RE.test(item) || seen.has(item)) continue;
    seen.add(item);
    ids.push(item);
    if (ids.length >= MAX_LESSONS) break;
  }
  return ids;
}

async function trustedLessonXp(): Promise<Map<string, number>> {
  const bonus = await fetchSupabaseLessons().catch(() => []);
  const xpById = new Map<string, number>();
  for (const lesson of [...BUNDLED, ...bonus]) {
    const xp = Math.round(lesson.xp);
    if (typeof lesson.id !== "string" || lesson.id.startsWith("gen-") || lesson.source === "generated" || lesson.source === "docs" || !LESSON_ID_RE.test(lesson.id) || !Number.isFinite(xp) || xp < 1 || xp > MAX_LESSON_XP) continue;
    xpById.set(lesson.id, xp);
  }
  return xpById;
}

function toBoard(rows: RankRow[]): Board {
  const entries = rows.map((row) => ({ id: row.player_id, name: row.name, xp: Number(row.xp), position: Number(row.rank_position), me: row.is_me === true })).sort((a, b) => a.position - b.position);
  return { entries, total: rows.length > 0 ? Number(rows[0]!.total) : 0, configured: true };
}

async function readBoard(db: SupabaseClient, playerId: string | null): Promise<Board> {
  const { data, error } = await db.rpc("pyfun_rank_board", { p_player_id: playerId, p_limit: 50 });
  if (error) throw error;
  return toBoard((data ?? []) as RankRow[]);
}

async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { id: user.id, user_metadata: user.user_metadata };
}

/** Nama bawaan dari profil Google (bukan email), dipakai saat baris pertama dibuat. */
function googleName(user: SessionUser): string | null {
  const meta = user.user_metadata ?? {};
  return normalizeName(meta.full_name) ?? normalizeName(meta.name) ?? null;
}

const PLAYER_COLUMNS = "player_id, name, custom_name, auth_user_id, secret_hash, xp";

/**
 * Pemain di papan peringkat = akun Google. Satu akun, satu baris, ditemukan
 * lewat `auth_user_id` dari sesi server. Tanpa login tidak ada baris sama sekali.
 */
async function getPlayerByAuth(db: SupabaseClient, authUserId: string): Promise<PlayerRow | null> {
  const { data, error } = await db
    .from("pyfun_rank_players")
    .select(PLAYER_COLUMNS)
    .eq("auth_user_id", authUserId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PlayerRow | null) ?? null;
}

/** Ambil atau buat baris pemain untuk akun ini. Aman dipanggil paralel. */
async function ensurePlayer(db: SupabaseClient, user: SessionUser, preferredName: string | null): Promise<PlayerRow> {
  const existing = await getPlayerByAuth(db, user.id);
  if (existing) return existing;

  const name = preferredName ?? googleName(user) ?? "Pelajar";
  const { data, error } = await db
    .from("pyfun_rank_players")
    .insert({
      player_id: randomUUID(),
      auth_user_id: user.id,
      name,
      // Kolom ini warisan sistem perangkat; akun login tidak memakainya.
      secret_hash: createHash("sha256").update(`auth:${user.id}`, "utf8").digest("hex"),
      xp: 0,
    })
    .select(PLAYER_COLUMNS)
    .single();

  if (error) {
    // Dua request bersamaan membuat baris yang sama: unique index auth_user_id menolak salah satunya.
    const raced = await getPlayerByAuth(db, user.id);
    if (!raced) throw error;
    return raced;
  }
  return data as PlayerRow;
}

/** Tambahkan materi resmi yang belum tercatat, lalu hitung ulang XP dari tabel completion. */
async function recordCompletions(
  db: SupabaseClient,
  player: PlayerRow,
  lessons: Array<{ id: string; xp: number }>,
): Promise<{ xp: number; gained: number }> {
  if (lessons.length === 0) return { xp: Number(player.xp), gained: 0 };

  const rows = lessons.map((lesson) => ({ player_id: player.player_id, lesson_id: lesson.id, xp: lesson.xp }));
  const { data: inserted, error: insertError } = await db
    .from("pyfun_rank_completions")
    .upsert(rows, { onConflict: "player_id,lesson_id", ignoreDuplicates: true })
    .select("xp");
  if (insertError) throw insertError;

  const gained = (inserted ?? []).reduce((sum, row) => sum + Number(row.xp ?? 0), 0);
  if (gained === 0) return { xp: Number(player.xp), gained: 0 };

  // XP selalu = jumlah completion, jadi tidak bisa melenceng walau ada request paralel.
  const { data: completions, error: sumError } = await db
    .from("pyfun_rank_completions")
    .select("xp")
    .eq("player_id", player.player_id);
  if (sumError) throw sumError;
  const xp = (completions ?? []).reduce((sum, row) => sum + Number(row.xp ?? 0), 0);

  const { error: xpError } = await db
    .from("pyfun_rank_players")
    .update({ xp, updated_at: new Date().toISOString() })
    .eq("player_id", player.player_id);
  if (xpError) throw xpError;
  return { xp, gained };
}

const NO_STORE = { "cache-control": "no-store" };

export async function GET(request: Request) {
  const limit = rateLimit(`rank:get:${clientIp(request)}`, 80, 60_000);
  if (!limit.ok) return errorResponse("Terlalu banyak permintaan. Coba lagi sebentar.", 429, limit.retryAfter);
  const db = adminClient();
  if (!db) return errorResponse("Papan peringkat belum dikonfigurasi di server.", 503);

  try {
    const user = await getSessionUser();
    const row = user ? await getPlayerByAuth(db, user.id) : null;
    // Penanda "kamu" hanya untuk akun login; tamu tidak pernah punya baris.
    const board = await readBoard(db, row?.player_id ?? null);
    return NextResponse.json(
      {
        ...board,
        authenticated: Boolean(user),
        custom_name: user ? (row?.custom_name ?? row?.name ?? googleName(user)) : null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("GET /api/ranks", error);
    return errorResponse("Papan peringkat belum siap. Jalankan schema rank di Supabase.", 503);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorResponse(CROSS_ORIGIN_ERROR, 403);
  const limit = rateLimit(`rank:post:${clientIp(request)}`, 30, 60_000);
  if (!limit.ok) return errorResponse("Terlalu banyak permintaan. Coba lagi sebentar.", 429, limit.retryAfter);
  if (bodyTooLarge(request, MAX_BODY_BYTES)) return errorResponse("Data terlalu besar.", 413);

  let rawBody: string;
  try { rawBody = await request.text(); } catch { return errorResponse("Body tidak valid.", 400); }
  if (rawBody.length > MAX_BODY_BYTES) return errorResponse("Data terlalu besar.", 413);

  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return errorResponse("Body JSON tidak valid.", 400); }
  if (!isRecord(body)) return errorResponse("Body tidak valid.", 400);

  const db = adminClient();
  if (!db) return errorResponse("Papan peringkat belum dikonfigurasi di server.", 503);

  // Aturan utama: tanpa login Google tidak ada pencatatan sama sekali.
  // Identitas hanya dari cookie sesi Supabase yang diverifikasi server;
  // playerId/secret/authUserId dari body tidak pernah dipakai.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Login dengan Google dulu agar XP tercatat di papan peringkat.", code: "login_required" },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    if (typeof body.customName === "string") {
      const customName = normalizeCustomName(body.customName);
      if (!customName) return errorResponse("Nama tidak valid.", 400);
      const player = await ensurePlayer(db, user, customName);
      const { error } = await db
        .from("pyfun_rank_players")
        .update({ name: customName, custom_name: customName })
        .eq("player_id", player.player_id);
      if (error) throw error;
      return NextResponse.json({ ok: true, custom_name: customName }, { headers: NO_STORE });
    }

    const completedIds = parseCompletedIds(body.completedIds);
    if (completedIds === null) return errorResponse("completedIds tidak valid.", 400);

    const player = await ensurePlayer(db, user, normalizeName(body.name));

    const xpById = await trustedLessonXp();
    const lessons = completedIds.flatMap((id) => {
      const xp = xpById.get(id);
      if (xp) return [{ id, xp }];
      if (/^bab\d+$/i.test(id)) return [{ id, xp: 100 }];
      return [];
    });

    const result = await recordCompletions(db, player, lessons);
    const board = await readBoard(db, player.player_id);
    return NextResponse.json(
      { ...board, authenticated: true, gained: result.gained },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("POST /api/ranks", error);
    return errorResponse("Papan peringkat belum siap. Jalankan schema rank di Supabase.", 503);
  }
}
