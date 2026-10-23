import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { bodyTooLarge, clientIp, rateLimit } from "@/lib/rate-limit";
import { generateLesson, type Level } from "@/lib/ai";
import { cleanTopic } from "@/lib/sanitize";
import { CROSS_ORIGIN_ERROR, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 30; // detik, untuk Vercel

/**
 * Generasi satu materi. Endpoint ini internal — hanya admin yang boleh memanggil,
 * user biasa tidak lagi bisa membuat materi sendiri.
 * Untuk seeding banyak sekaligus, pakai /api/admin/seed.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: CROSS_ORIGIN_ERROR }, { status: 403 });
  }
  const limited = rateLimit(`generate:${clientIp(req)}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (bodyTooLarge(req, 4 * 1024)) {
    return NextResponse.json({ error: "Body permintaan terlalu besar." }, { status: 413 });
  }

  const raw = await req.text().catch(() => "");
  if (raw.length > 4 * 1024) {
    return NextResponse.json({ error: "Body permintaan terlalu besar." }, { status: 413 });
  }
  let body: { topic?: unknown; level?: unknown } | null = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Body bukan JSON yang valid." }, { status: 400 });
    }
  }

  const topic = cleanTopic(body?.topic);
  const level: Level = body?.level === "menengah" ? "menengah" : "pemula";
  if (topic.length < 3) return NextResponse.json({ error: "Tulis topik minimal 3 huruf." }, { status: 400 });

  const key = process.env.GROQ_API_KEY || "";
  if (!key) return NextResponse.json({ error: "GROQ_API_KEY tidak ada di environment." }, { status: 500 });

  const result = await generateLesson(topic, level, key);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ lesson: result.lesson });
}
