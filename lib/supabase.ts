import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Tabel materi inti + bonus yang disinkronkan admin lewat /api/admin/sync. */
export const LESSONS_TABLE = "pyfun_lessons";

/** True kalau Supabase sudah dikonfigurasi di environment. */
export const supabaseConfigured = Boolean(url && anon);

/**
 * Browser / Edge — singleton.
 * Null kalau env belum diisi, supaya app tetap jalan (materi bonus kosong).
 */
export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon) : null;
