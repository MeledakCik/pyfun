import "server-only";

/**
 * Cek sederhana bahwa request POST berasal dari origin aplikasi sendiri.
 *
 * Endpoint PyFun tidak memakai cookie sesi, jadi ini bukan pengganti CSRF
 * token; lapisan ini menutup pemanggilan lintas-origin dari browser dan
 * membuat endpoint admin/AI tidak bisa dipicu dari situs lain.
 *
 * Request tanpa Origin/Referer (curl, health check, server-ke-server) tetap
 * diizinkan karena autentikasi admin memakai header secret tersendiri.
 */
export function isSameOrigin(req: Request): boolean {
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!source) return true;

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return false;
  }

  const host = req.headers.get("host") ?? new URL(req.url).host;
  if (url.host !== host) return false;

  // Di production, jangan terima Origin http:// walau host-nya sama.
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return false;
  return true;
}

/** Alasan penolakan yang aman ditampilkan ke client (tanpa detail internal). */
export const CROSS_ORIGIN_ERROR = "Permintaan ditolak karena berasal dari origin lain.";
