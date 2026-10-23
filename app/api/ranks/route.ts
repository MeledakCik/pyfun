import "server-only";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUNDLED, fetchSupabaseLessons } from "@/lib/lessons";
import { bodyTooLarge, clientIp, rateLimit } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase-admin";
import { CROSS_ORIGIN_ERROR, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_RE = /^[a-f0-9]{64}$/i;
const LESSON_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_NAME = 20;
const MAX_LESSONS = 50; // FIX: tadinya 1, jadi gak bisa kirim 1 bab
const MAX_LESSON_XP = 2000;
const MAX_BODY_BYTES = 64 * 1024;

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
  const name = value
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/[^\p{L}\p{N} ._-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
  return name.length > 0 ? name : null;
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
    if (
      typeof lesson.id !== "string" ||
      lesson.id.startsWith("gen-") ||
      lesson.source === "generated" ||
      lesson.source === "docs" ||
      !LESSON_ID_RE.test(lesson.id) ||
      !Number.isFinite(xp) ||
      xp < 1 ||
      xp > MAX_LESSON_XP
    ) {
      continue;
    }
    xpById.set(lesson.id, xp);
  }
  return xpById;
}

function toBoard(rows: RankRow[]): Board {
  const entries = rows
    .map((row) => ({
      id: row.player_id,
      name: row.name,
      xp: Number(row.xp),
      position: Number(row.rank_position),
      me: row.is_me === true,
    }))
    .sort((a, b) => a.position - b.position);

  return {
    entries,
    total: rows.length > 0 ? Number(rows[0]!.total) : 0,
    configured: true,
  };
}

async function readBoard(db: SupabaseClient, playerId: string | null): Promise<Board> {
  const { data, error } = await db.rpc("pyfun_rank_board", {
    p_player_id: playerId,
    p_limit: 50,
  });
  if (error) throw error;
  return toBoard((data ?? []) as RankRow[]);
}

export async function GET(request: Request) {
  const limit = rateLimit(`rank:get:${clientIp(request)}`, 80, 60_000);
  if (!limit.ok) {
    return errorResponse("Terlalu banyak permintaan. Coba lagi sebentar.", 429, limit.retryAfter);
  }

  const rawPlayerId = new URL(request.url).searchParams.get("playerId");
  const playerId = rawPlayerId?.trim() || null;
  if (playerId && !UUID_RE.test(playerId)) {
    return errorResponse("ID pemain tidak valid.", 400);
  }

  const db = adminClient();
  if (!db) {
    return errorResponse("Papan peringkat belum dikonfigurasi di server.", 503);
  }

  try {
    const board = await readBoard(db, playerId);
    return NextResponse.json(board, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("GET /api/ranks", error);
    return errorResponse("Papan peringkat belum siap. Jalankan schema rank di Supabase.", 503);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return errorResponse(CROSS_ORIGIN_ERROR, 403);
  }
  const limit = rateLimit(`rank:post:${clientIp(request)}`, 30, 60_000);
  if (!limit.ok) {
    return errorResponse("Terlalu banyak permintaan. Coba lagi sebentar.", 429, limit.retryAfter);
  }
  if (bodyTooLarge(request, MAX_BODY_BYTES)) {
    return errorResponse("Data terlalu besar.", 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse("Body tidak valid.", 400);
  }
  if (rawBody.length > MAX_BODY_BYTES) {
    return errorResponse("Data terlalu besar.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Body JSON tidak valid.", 400);
  }
  if (!isRecord(body)) {
    return errorResponse("Body tidak valid.", 400);
  }

  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const secret = typeof body.secret === "string" ? body.secret : "";
  const name = normalizeName(body.name);
  const completedIds = parseCompletedIds(body.completedIds);

  if (!UUID_RE.test(playerId) || !SECRET_RE.test(secret) || !name || completedIds === null) {
    return errorResponse("Data peringkat tidak valid.", 400);
  }

  const db = adminClient();
  if (!db) {
    return errorResponse("Papan peringkat belum dikonfigurasi di server.", 503);
  }

  try {
    const xpById = await trustedLessonXp();
    
    // FIX UTAMA BIAR BAB1 MASUK RANK
    const lessons = completedIds.flatMap((id) => {
      const xp = xpById.get(id);
      if (xp) return [{ id, xp }];
      
      // FALLBACK: kalo id nya "bab1", "bab2" dll yang gak ada di katalog
      // kita kasih XP default 100 biar user tetep ke-create dan masuk rank
      if (/^bab\d+$/i.test(id) || id.startsWith("chapter")) {
        return [{ id, xp: 100 }];
      }
      return [];
    });

    const secretHash = createHash("sha256").update(secret, "utf8").digest("hex");
    const { data, error } = await db.rpc("pyfun_rank_sync", {
      p_player_id: playerId,
      p_secret_hash: secretHash,
      p_name: name,
      p_lessons: lessons,
      // FIX: true terus biar login pertama kali langsung bikin baris di pyfun_rank_players
      // tadinya: lessons.length > 0 -> bikin user gak ke-create kalo bab1 gak kebaca
      p_create: true,
    });
    if (error) throw error;

    const result = (Array.isArray(data) ? data[0] : data) as SyncRow | null | undefined;
    if (!result?.ok) {
      if (
        result?.reason === "invalid_name" ||
        result?.reason === "invalid_lessons" ||
        result?.reason === "invalid_player"
      ) {
        return errorResponse("Data peringkat tidak valid.", 400);
      }
      return errorResponse("Sesi peringkat tidak valid.", 401);
    }

    const board = await readBoard(db, playerId);
    return NextResponse.json(
      { ...board, gained: Number(result.gained ?? 0) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("POST /api/ranks", error);
    return errorResponse("Papan peringkat belum siap. Jalankan schema rank di Supabase.", 503);
  }
}