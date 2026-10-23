import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Hanya izinkan path internal, supaya `next` tidak bisa dipakai open redirect. */
function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/quest";
  return value;
}

/**
 * Di balik proxy Vercel, `request.url` biasanya sudah memakai domain publik.
 * Header forwarded dipakai sebagai cadangan agar redirect tetap ke domain
 * Vercel dan bukan ke host internal.
 */
function publicOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") === "http" ? "http" : "https";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const origin = publicOrigin(request);

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/quest?auth=error`);
}
