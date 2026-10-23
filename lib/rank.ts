"use client";

/**
 * Identitas rank disimpan di perangkat ini.
 *
 * - `playerId` adalah UUID publik untuk menandai baris di papan peringkat.
 * - `secret` hanya dikirim ke /api/ranks dan tidak pernah ditampilkan.
 * - Client hanya mengirim ID materi, bukan XP. Server menghitung XP dari
 *   katalog materi resmi supaya angka rank tidak bisa di-inject dari browser.
 */

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
};

export type RankSyncResult = RankBoard & { gained: number };

const PLAYER_KEY = "pyfun:rank-player";
const SECRET_KEY = "pyfun:rank-secret";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_RE = /^[a-f0-9]{64}$/i;
const LESSON_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
// Satu request hanya boleh membawa satu penyelesaian. Ini mencegah client
// mengirim seluruh katalog sekaligus untuk melompati papan peringkat.
const MAX_SYNC_LESSONS = 1;

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function makeUuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function credentials(): { playerId: string; secret: string } | null {
  try {
    let playerId = localStorage.getItem(PLAYER_KEY);
    let secret = localStorage.getItem(SECRET_KEY);

    if (!playerId || !UUID_RE.test(playerId)) {
      playerId = makeUuid();
      localStorage.setItem(PLAYER_KEY, playerId);
    }
    if (!secret || !SECRET_RE.test(secret)) {
      secret = randomHex(32);
      localStorage.setItem(SECRET_KEY, secret);
    }

    return { playerId, secret };
  } catch {
    return null;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Biarkan pesan fallback di bawah yang dipakai.
  }

  if (!response.ok) {
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

/** Ambil papan peringkat. `playerId` hanya untuk menandai baris "kamu". */
export async function fetchRankBoard(): Promise<RankBoard> {
  const id = credentials()?.playerId;
  const query = id ? `?playerId=${encodeURIComponent(id)}` : "";
  const response = await fetch(`/api/ranks${query}`, { cache: "no-store" });
  return readJson<RankBoard>(response);
}

/**
 * Daftarkan/rename pemain dan kirim satu materi resmi yang baru selesai.
 * Server mengabaikan ID materi yang tidak ada di katalog resmi, jadi materi
 * buatan sendiri tidak bisa menambah XP peringkat.
 */
export async function syncRank(name: string, completedIds: string[]): Promise<RankSyncResult> {
  const creds = credentials();
  if (!creds) throw new Error("Penyimpanan browser tidak tersedia.");

  const ids = [...new Set(completedIds)]
    .filter((id) => LESSON_ID_RE.test(id))
    .slice(0, MAX_SYNC_LESSONS);

  const response = await fetch("/api/ranks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: creds.playerId,
      secret: creds.secret,
      name,
      completedIds: ids,
    }),
  });

  return readJson<RankSyncResult>(response);
}

/** Kirim satu penyelesaian materi. Aman dipanggil fire-and-forget. */
export async function submitRankCompletion(lessonId: string, name: string | null) {
  if (!name?.trim() || !LESSON_ID_RE.test(lessonId)) return;
  await syncRank(name, [lessonId]);
}

/**
 * Simpan nama tampilan untuk pemain yang sedang login.
 *
 * Identitas tetap memakai pasangan playerId + secret perangkat, bukan
 * `authUserId` yang dikirim dari browser. Server menentukan pemilik sesi dari
 * cookie Supabase, sehingga nama tidak bisa dipasang ke akun lain.
 */
export async function saveRankName(name: string): Promise<string> {
  const creds = credentials();
  if (!creds) throw new Error("Penyimpanan browser tidak tersedia.");

  const trimmed = name.trim().slice(0, 20);
  if (!trimmed) throw new Error("Nama wajib diisi.");

  const response = await fetch("/api/ranks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: creds.playerId,
      secret: creds.secret,
      name: trimmed,
      customName: trimmed,
    }),
  });

  const payload = await readJson<{ custom_name?: string }>(response);
  return payload.custom_name ?? trimmed;
}
