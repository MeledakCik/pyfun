import "server-only";
import { createHash } from "node:crypto";
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function getCurrentPlayer(
  db: SupabaseClient,
  authUserId: string | null,
  playerId: string | null,
): Promise<PlayerRow | null> {
  if (authUserId) {
    const { data, error } = await db
      .from("pyfun_rank_players")
      .select("player_id, name, custom_name, auth_user_id, secret_hash, xp")
      .eq("auth_user_id", authUserId)
      .limit(1)
      .maybeSingle();
    if (!error && data) return data as PlayerRow;
  }
  if (playerId) {
    const { data, error } = await db
      .from("pyfun_rank_players")
      .select("player_id, name, custom_name, auth_user_id, secret_hash, xp")
      .eq("player_id", playerId)
      .limit(1)
      .maybeSingle();
    if (!error && data) return data as PlayerRow;
  }
  return null;
}

/**
 * Sinkronisasi pemain tanpa RPC `pyfun_rank_sync`.
 *
 * Fungsi SQL itu bisa punya dua overload lama di Supabase sehingga PostgREST
 * menolak semua panggilan (PGRST203). Operasi tabel langsung di bawah tetap
 * memakai service role dan aturan yang sama: XP dihitung dari katalog resmi,
 * satu materi hanya dihitung sekali, dan secret perangkat diverifikasi.
 */
async function syncPlayer(
  db: SupabaseClient,
  input: {
    playerId: string;
    authUserId: string | null;
    secretHash: string;
    name: string;
    lessons: Array<{ id: string; xp: number }>;
  },
): Promise<SyncResult> {
  let player = await getCurrentPlayer(db, input.authUserId, input.playerId);

  if (!player) {
    const { data, error } = await db
      .from("pyfun_rank_players")
      .insert({
        player_id: input.playerId,
        auth_user_id: input.authUserId,
        name: input.name,
        secret_hash: input.secretHash,
        xp: 0,
      })
      .select("player_id, name, custom_name, auth_user_id, secret_hash, xp")
      .single();

    if (error) {
      // Bisa terjadi race saat dua request membuat pemain yang sama.
      const existing = await getCurrentPlayer(db, input.authUserId, input.playerId);
      if (!existing) throw error;
      player = existing;
    } else {
      player = data as PlayerRow;
    }
  }

  // Jangan campur progres dua akun yang berbeda di perangkat yang sama.
  if (input.authUserId && player.auth_user_id && player.auth_user_id !== input.authUserId) {
    return { ok: false, reason: "invalid_player" };
  }

  // Sesi login adalah bukti kepemilikan yang lebih kuat daripada secret
  // perangkat. Ini juga membuat akun Google bisa dipakai di beberapa device.
  const ownsBySession = Boolean(input.authUserId && player.auth_user_id === input.authUserId);
  if (!ownsBySession && player.secret_hash !== input.secretHash) {
    return { ok: false, reason: "invalid_secret" };
  }

  const { error: updateError } = await db
    .from("pyfun_rank_players")
    .update({
      name: input.name,
      auth_user_id: player.auth_user_id ?? input.authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("player_id", player.player_id);
  if (updateError) throw updateError;

  let gained = 0;
  if (input.lessons.length > 0) {
    const rows = input.lessons.map((lesson) => ({
      player_id: player!.player_id,
      lesson_id: lesson.id,
      xp: lesson.xp,
    }));
    const { data: inserted, error: insertError } = await db
      .from("pyfun_rank_completions")
      .upsert(rows, { onConflict: "player_id,lesson_id", ignoreDuplicates: true })
      .select("xp");
    if (insertError) throw insertError;
    gained = (inserted ?? []).reduce((sum, row) => sum + Number(row.xp ?? 0), 0);
  }

  if (gained > 0) {
    // Hitung ulang dari completion agar XP tetap konsisten kalau sebelumnya
    // ada baris lama yang tidak sinkron.
    const { data: completions, error: sumError } = await db
      .from("pyfun_rank_completions")
      .select("xp")
      .eq("player_id", player.player_id);
    if (sumError) throw sumError;
    const xp = (completions ?? []).reduce((sum, row) => sum + Number(row.xp ?? 0), 0);

    const { data: updated, error: xpError } = await db
      .from("pyfun_rank_players")
      .update({ xp, updated_at: new Date().toISOString() })
      .eq("player_id", player.player_id)
      .select("xp")
      .single();
    if (xpError) throw xpError;
    return { ok: true, xp: Number(updated.xp), gained };
  }

  return { ok: true, xp: Number(player.xp), gained: 0 };
}

export async function GET(request: Request) {
  const limit = rateLimit(`rank:get:${clientIp(request)}`, 80, 60_000);
  if (!limit.ok) return errorResponse("Terlalu banyak permintaan. Coba lagi sebentar.", 429, limit.retryAfter);
  const rawPlayerId = new URL(request.url).searchParams.get("playerId");
  const playerId = rawPlayerId?.trim() || null;
  const db = adminClient();
  if (!db) return errorResponse("Papan peringkat belum dikonfigurasi di server.", 503);

  try {
    const user = await getSessionUser();
    const authUserId = user?.id ?? null;
    const row = await getCurrentPlayer(db, authUserId, playerId);
    const boardPlayerId = row?.player_id ?? playerId;
    const board = await readBoard(db, boardPlayerId);
    return NextResponse.json({ ...board, custom_name: row?.custom_name ?? row?.name ?? null }, { headers: { "cache-control": "no-store" } });
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

  const sessionUser = await getSessionUser();
  // Jangan pernah percaya authUserId dari body: identitas login hanya boleh
  // berasal dari cookie sesi Supabase yang diverifikasi server.
  const authUserId = sessionUser?.id ?? null;
  const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
  const secret = typeof body.secret === "string" ? body.secret.trim() : "";
  // `name` dipakai untuk setiap sync. Hanya `customName` yang menandakan
  // permintaan ganti nama, supaya sync biasa tidak berhenti sebelum XP dicatat.
  const hasCustomName = typeof body.customName === "string";
  const customName = hasCustomName ? normalizeCustomName(body.customName) : null;
  const name = normalizeName(body.name) ?? customName ?? "Pelajar";
  const completedIds = parseCompletedIds(body.completedIds);

  if (hasCustomName) {
    if (!authUserId) return errorResponse("Sesi login belum aktif.", 401);
    if (!customName) return errorResponse("Nama tidak valid.", 400);
    if (!UUID_RE.test(playerId)) return errorResponse("playerId tidak valid.", 400);
    if (secret.length < 20) return errorResponse("secret terlalu pendek.", 400);

    try {
      const secretHash = createHash("sha256").update(secret, "utf8").digest("hex");
      const current = await getCurrentPlayer(db, authUserId, playerId);

      if (!current) {
        const { data: created, error } = await db
          .from("pyfun_rank_players")
          .insert({
            player_id: playerId,
            auth_user_id: authUserId,
            name: customName,
            custom_name: customName,
            secret_hash: secretHash,
            xp: 0,
          })
          .select("player_id, custom_name")
          .single();
        if (error) throw error;
        return NextResponse.json(
          { ok: true, custom_name: customName, player_id: created.player_id },
          { headers: { "cache-control": "no-store" } },
        );
      }

      // Jangan biarkan sesi mana pun mengambil alih baris milik akun lain.
      if (current.auth_user_id && current.auth_user_id !== authUserId) {
        return errorResponse("Baris peringkat ini milik akun lain.", 403);
      }
      if (!current.auth_user_id && current.secret_hash !== secretHash) {
        return errorResponse("secret tidak cocok.", 401);
      }

      const { error } = await db
        .from("pyfun_rank_players")
        .update({
          name: customName,
          custom_name: customName,
          auth_user_id: authUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("player_id", current.player_id);
      if (error) throw error;

      return NextResponse.json(
        { ok: true, custom_name: customName, player_id: current.player_id },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      console.error("POST /api/ranks (custom name)", error);
      return errorResponse("Gagal menyimpan nama. Coba lagi.", 503);
    }
  }

  if (!UUID_RE.test(playerId)) return errorResponse("playerId tidak valid.", 400);
  if (secret.length < 20) return errorResponse("secret terlalu pendek.", 400);
  if (!name || name.length < 1 || name.length > MAX_NAME) return errorResponse("Nama tidak valid.", 400);
  if (completedIds === null) return errorResponse("completedIds tidak valid.", 400);

  try {
    const xpById = await trustedLessonXp();
    const lessons = completedIds.flatMap((id) => {
      const xp = xpById.get(id);
      if (xp) return [{ id, xp }];
      if (/^bab\d+$/i.test(id)) return [{ id, xp: 100 }];
      return [];
    });

    const result = await syncPlayer(db, {
      playerId,
      authUserId,
      secretHash: createHash("sha256").update(secret, "utf8").digest("hex"),
      name,
      lessons,
    });

    if (!result.ok) {
      return errorResponse(
        result.reason === "invalid_secret" ? "secret tidak cocok." : "Papan peringkat menolak permintaan.",
        result.reason === "invalid_secret" ? 401 : 400,
      );
    }

    const current = await getCurrentPlayer(db, authUserId, playerId);
    const board = await readBoard(db, current?.player_id ?? playerId);
    return NextResponse.json(
      { ...board, gained: result.gained },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("POST /api/ranks", error);
    return errorResponse("Papan peringkat belum siap. Jalankan schema rank di Supabase.", 503);
  }
}