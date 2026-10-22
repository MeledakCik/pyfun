import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client service-role untuk operasi tulis (seed admin).
 * Modul ini ditandai `server-only` supaya tidak pernah ikut ke bundle browser.
 * Mengembalikan null kalau environment belum lengkap.
 */
export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
