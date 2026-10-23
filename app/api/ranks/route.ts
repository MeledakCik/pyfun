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

type SyncRow = {
  ok: boolean;
  reason: string | null;
  xp: number | null;
  gained: number | null;
};

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

async function getCurrentPlayer(db: SupabaseClient, authUserId: string | null, playerId: string | null) {
  if (authUserId) {
    const { data, error } = await db.from("pyfun_rank_players").select("player_id, name, custom_name, auth_user_id, secret_hash, xp").eq("auth_user_id", authUserId).limit(1).maybeSingle();
    if (!error && data) return data;
  }
  if (playerId) {
    const { data, error } = await db.from("pyfun_rank_players").select("player_id, name, custom_name, auth_user_id, secret_hash, xp").eq("player_id", playerId).limit(1).maybeSingle();
    if (!error && data) return data;
  }
  return null;
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
  const authUserId = sessionUser?.id ?? (typeof body.authUserId === "string" ? body.authUserId.trim() || null : null);
  const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
  const secret = typeof body.secret === "string" ? body.secret.trim() : "";
  const customName = normalizeCustomName(body.customName ?? body.name);
  const name = normalizeName(body.name) ?? customName ?? "Pelajar";
  const completedIds = parseCompletedIds(body.completedIds);

  if (customName) {
    if (!authUserId && !playerId) return errorResponse("Sesi login belum aktif.", 401);
    const current = await getCurrentPlayer(db, authUserId, playerId || null);
    if (!current) {
      const fallbackPlayerId = playerId || randomUUID();
      const created = await db.from("pyfun_rank_players").insert({
        player_id: fallbackPlayerId,
        auth_user_id: authUserId,
        name: customName,
        custom_name: customName,
        secret_hash: createHash("sha256").update(secret || `pyfun-${fallbackPlayerId}`).digest("hex"),
        xp: 0,
      }).select("player_id, name, custom_name").single();
      if (created.error) throw created.error;
      return NextResponse.json({ ok: true, custom_name: customName, player_id: created.data.player_id }, { headers: { "cache-control": "no-store" } });
    }

    const targetId = current.player_id;
    const { error } = await db.from("pyfun_rank_players").update({
      name: customName,
      custom_name: customName,
      auth_user_id: authUserId ?? current.auth_user_id,
      updated_at: new Date().toISOString(),
    }).eq("player_id", targetId);
    if (error) throw error;
    return NextResponse.json({ ok: true, custom_name: customName, player_id: targetId }, { headers: { "cache-control": "no-store" } });
  }

  if (playerId.length < 10) return errorResponse(`playerId tidak valid.`, 400);
  if (secret.length < 20) return errorResponse(`secret terlalu pendek.`, 400);
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

    const secretHash = createHash("sha256").update(secret, "utf8").digest("hex");
    const rpcPayload: Record<string, unknown> = {
      p_player_id: playerId,
      p_auth_user_id: authUserId ?? null,
      p_secret_hash: secretHash,
      p_name: name,
      p_lessons: lessons,
      p_create: true,
    };

    const { data, error } = await db.rpc("pyfun_rank_sync", rpcPayload);
    if (error) throw error;

    const result = (Array.isArray(data) ? data[0] : data) as SyncRow | null | undefined;
    if (!result?.ok) {
      return errorResponse(result?.reason ?? "Papan peringkat menolak permintaan.", result?.reason === "invalid_secret" ? 401 : 400);
    }

    const board = await readBoard(db, authUserId ? (await getCurrentPlayer(db, authUserId, playerId))?.player_id ?? playerId : playerId);
    return NextResponse.json({ ...board, gained: Number(result.gained ?? 0) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("POST /api/ranks", error);
    return errorResponse("Papan peringkat belum siap. Jalankan schema rank di Supabase.", 503);
  }
}