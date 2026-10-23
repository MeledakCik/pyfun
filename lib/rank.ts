"use client";

/**
 * Papan peringkat hanya untuk akun Google.
 *
 * - Identitas = sesi login Supabase (cookie), diverifikasi di server.
 *   Tidak ada lagi ID/secret perangkat: tanpa login, tidak ada data rank.
 * - Client hanya mengirim ID materi, bukan XP. Server menghitung XP dari
 *   katalog materi resmi dan satu materi hanya dihitung sekali per akun.
 * - Progres lokal tetap jalan untuk tamu; saat login, materi resmi yang sudah
 *   selesai di perangkat ini dikirim sekali (`syncCompleted`).
 */

import { supabaseBrowser } from "./supabase/client";

export type RankEntry = {
  id: string;
  name: string;
  xp: number;
  position: number;
  me: boolean;
};

export type RankBoard = {
  entries: RankEntry[];
  total: number;
  configured: boolean;
  /** True kalau permintaan datang dari sesi Google yang valid. */
  authenticated: boolean;
};

export type RankSyncResult = RankBoard & { gained: number };

/** Dilempar saat server menolak karena belum login Google. */
export class RankLoginRequiredError extends Error {
  constructor(message = "Login dengan Google dulu agar XP tercatat di papan peringkat.") {
    super(message);
    this.name = "RankLoginRequiredError";
  }
}

const LESSON_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
// Sama dengan batas server (MAX_LESSONS di /api/ranks).
const SYNC_CHUNK = 50;

async function readJson<T>(response: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Biarkan pesan fallback di bawah yang dipakai.
  }

  if (!response.ok) {
    if (response.status === 401) throw new RankLoginRequiredError();
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : "Papan peringkat belum bisa dimuat.";
    throw new Error(message);
  }

  return body as T;
}

/** Cek cepat di browser apakah ada sesi Google, supaya tamu tidak memicu request sia-sia. */
export async function hasRankSession(): Promise<boolean> {
  const client = supabaseBrowser;
  if (!client) return false;
  try {
    const { data: { session } } = await client.auth.getSession();
    return Boolean(session?.user);
  } catch {
    return false;
  }
}

/** Ambil papan peringkat. Baris "kamu" hanya muncul untuk akun yang login. */
export async function fetchRankBoard(): Promise<RankBoard> {
  const response = await fetch("/api/ranks", { cache: "no-store" });
  return readJson<RankBoard>(response);
}

/** ID materi yang sudah selesai di perangkat ini dan layak dikirim ke rank. */
export function completedLessonIds(progress: Record<string, { done: boolean }>): string[] {
  return Object.entries(progress)
    .filter(([id, p]) => p.done && !id.startsWith("gen-") && LESSON_ID_RE.test(id))
    .map(([id]) => id);
}

/**
 * Kirim materi yang sudah selesai ke akun yang sedang login.
 * Dipecah per 50 ID. Server mengabaikan materi buatan sendiri/tidak dikenal
 * dan materi yang sudah tercatat. Melempar `RankLoginRequiredError` untuk tamu.
 */
export async function syncCompleted(ids: string[]): Promise<RankSyncResult> {
  const unique = [...new Set(ids)].filter((id) => LESSON_ID_RE.test(id));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += SYNC_CHUNK) chunks.push(unique.slice(i, i + SYNC_CHUNK));
  if (chunks.length === 0) chunks.push([]);

  let last: RankSyncResult | null = null;
  let gained = 0;
  for (const chunk of chunks) {
    const response = await fetch("/api/ranks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completedIds: chunk }),
    });
    const result = await readJson<RankSyncResult>(response);
    gained += result.gained;
    last = result;
  }
  return { ...(last as RankSyncResult), gained };
}

/**
 * Muat papan untuk halaman rank: tamu hanya membaca; akun login sekalian
 * mengirim materi lokal yang belum tercatat lalu mendapat papan terbaru.
 */
export async function loadRank(localIds: string[]): Promise<RankBoard> {
  const board = await fetchRankBoard();
  if (!board.authenticated) return board;
  return syncCompleted(localIds);
}

export type RankSubmitStatus = "recorded" | "guest" | "error";

/**
 * Kirim satu penyelesaian materi. Tidak pernah melempar: tamu → "guest"
 * (tidak masuk rank), gagal jaringan/server → "error".
 */
export async function submitRankCompletion(lessonId: string): Promise<RankSubmitStatus> {
  if (!LESSON_ID_RE.test(lessonId)) return "error";
  if (!(await hasRankSession())) return "guest";
  try {
    await syncCompleted([lessonId]);
    return "recorded";
  } catch (error) {
    return error instanceof RankLoginRequiredError ? "guest" : "error";
  }
}

/**
 * Simpan nama tampilan untuk akun yang sedang login. Pemilik baris ditentukan
 * server dari cookie sesi, bukan dari data yang dikirim browser.
 */
export async function saveRankName(name: string): Promise<string> {
  const trimmed = name.trim().slice(0, 20);
  if (!trimmed) throw new Error("Nama wajib diisi.");

  const response = await fetch("/api/ranks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ customName: trimmed }),
  });

  const payload = await readJson<{ custom_name?: string }>(response);
  return payload.custom_name ?? trimmed;
}
