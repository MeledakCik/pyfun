import "server-only";
import { timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 24;

export type AdminAuth = { ok: true } | { ok: false; status: number; error: string };

/**
 * Verifikasi header `x-admin-secret` dengan perbandingan waktu konstan.
 * Fail-closed: secret yang kosong/terlalu pendek tidak pernah dianggap valid.
 */
export function requireAdmin(req: Request): AdminAuth {
  const expected = process.env.ADMIN_SEED_SECRET?.trim() ?? "";
  if (expected.length < MIN_SECRET_LENGTH) {
    return {
      ok: false,
      status: 500,
      error: `ADMIN_SEED_SECRET belum diatur dengan aman (minimal ${MIN_SECRET_LENGTH} karakter).`,
    };
  }

  const given = req.headers.get("x-admin-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // Bandingkan panjang dulu agar timingSafeEqual tidak melempar error.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true };
}
