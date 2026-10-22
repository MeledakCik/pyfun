import { NextResponse } from "next/server";

/**
 * Halaman "Buat materi" sudah dihapus — user tidak lagi bisa membuat materi AI
 * sendiri. Materi bonus dibuat admin lewat /api/admin/seed.
 *
 * Dipakai route handler (bukan page) supaya redirect jadi HTTP 307 berversi
 * client: layout `(app)` berisi komponen client, sehingga `redirect()` dari
 * server component akan tertangkap di client, bukan di server.
 */
export function GET(req: Request) {
  return NextResponse.redirect(new URL("/quest", req.url), 307);
}
