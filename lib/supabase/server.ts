import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            // Jangan paksa httpOnly: @supabase/ssr menyimpan sesi di cookie
            // yang juga dibaca Supabase client di browser. Kalau httpOnly
            // dipaksa true, login Google berhasil di server tetapi UI tetap
            // menganggap pengguna belum login.
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component render dapat berjalan tanpa menulis cookie.
        }
      },
    },
  });
}
