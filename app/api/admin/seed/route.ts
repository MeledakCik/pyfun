import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { bodyTooLarge, clientIp, rateLimit } from "@/lib/rate-limit";
import { LESSONS_TABLE } from "@/lib/supabase";
import { generateLesson, slugify, type Level } from "@/lib/ai";
import { cleanTopic, cleanText } from "@/lib/sanitize";
import { CROSS_ORIGIN_ERROR, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60; // detik, untuk Vercel

/** Topik preset yang dipakai kalau body tidak menyertakan daftar topik. */
const PRESET_TOPICS: { topic: string; level: Level }[] = [
  { topic: "Dasar argparse", level: "menengah" },
  { topic: "Logging Python", level: "menengah" },
  { topic: "Dataclass & tipe data", level: "menengah" },
  { topic: "Context manager", level: "menengah" },
  { topic: "Generator & yield", level: "menengah" },
  { topic: "Decorator sederhana", level: "menengah" },
  { topic: "SQLite dasar", level: "menengah" },
  { topic: "Unit test dengan unittest", level: "menengah" },
  { topic: "Async/await dasar", level: "menengah" },
  { topic: "Pipeline CSV & JSON", level: "menengah" },
];

const MAX_PER_REQUEST = 20;
const MAX_BONUS = 100; // batas materi bonus (materi inti disimpan terpisah lewat sync)
const CONCURRENCY = 3; // jumlah request Groq yang jalan bersamaan

type TopicReq = { topic: string; level: Level };

type SeedResult = {
  topic: string;
  status: "ok" | "error";
  id?: string;
  title?: string;
  error?: string;
};

function parseTopics(body: unknown): TopicReq[] {
  const b = (body ?? {}) as Record<string, unknown>;
  const bodyLevel: Level = b.level === "menengah" ? "menengah" : "pemula";

  const raw = b.topics;
  let list: TopicReq[] = [];

  if (Array.isArray(raw)) {
    list = raw
      .map((t: unknown) => {
        if (typeof t === "string") return { topic: cleanTopic(t), level: bodyLevel };
        if (t && typeof t === "object") {
          const o = t as Record<string, unknown>;
          if (typeof o.topic !== "string") return null;
          return {
            topic: cleanTopic(o.topic),
            level: o.level === "menengah" ? "menengah" : bodyLevel,
          };
        }
        return null;
      })
      .filter((t): t is TopicReq => !!t && t.topic.length >= 3);
  } else if (typeof b.topic === "string" && cleanTopic(b.topic).length >= 3) {
    list = [{ topic: cleanTopic(b.topic), level: bodyLevel }];
  } else {
    list = PRESET_TOPICS;
  }

  // Buang topik duplikat (id-nya ikut sama, jadi tidak perlu dua baris).
  const seen = new Set<string>();
  return list.filter((t) => {
    const key = slugify(t.topic);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Tambah materi bonus via AI ke Supabase.
 * POST /api/admin/seed dengan header x-admin-secret.
 *
 * Untuk menyimpan seluruh materi inti + katalog bonus tanpa Groq, pakai
 * /api/admin/sync terlebih dahulu.
 *
 * Body (opsional):
 *   { "topics": ["String & f-string", { "topic": "...", "level": "menengah" }],
 *     "level": "pemula", "chapter": "Materi Bonus",
 *     "track": "Automasi & File", "limit": 10 }
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: CROSS_ORIGIN_ERROR }, { status: 403 });
  }
  // Batasi brute force secret dan pemakaian Groq per IP.
  const limited = rateLimit(`seed:${clientIp(req)}`, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (bodyTooLarge(req)) {
    return NextResponse.json({ error: "Body permintaan terlalu besar." }, { status: 413 });
  }

  const key = process.env.GROQ_API_KEY || "";
  if (!key) return NextResponse.json({ error: "GROQ_API_KEY tidak ada di environment." }, { status: 500 });

  const db = adminClient();
  if (!db) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY tidak ada di environment. Ambil dari Supabase Dashboard → Project Settings → API." },
      { status: 500 },
    );
  }

  const raw = await req.text().catch(() => "");
  if (raw.length > 16 * 1024) {
    return NextResponse.json({ error: "Body permintaan terlalu besar." }, { status: 413 });
  }
  let body: unknown = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Body bukan JSON yang valid." }, { status: 400 });
    }
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const chapter =
    typeof b.chapter === "string" && b.chapter.trim() ? cleanText(b.chapter, 40) : "Materi Bonus";
  const track =
    typeof b.track === "string" && b.track.trim() ? cleanText(b.track, 40) : "Materi Bonus";

  const all = parseTopics(body);
  const limit = Math.min(MAX_PER_REQUEST, Math.max(1, Number(b.limit) || all.length || 1));
  const topics = all.slice(0, limit);

  if (topics.length === 0) {
    return NextResponse.json({ error: "Tidak ada topik yang valid untuk di-seed." }, { status: 400 });
  }

  // Hitung hanya materi bonus; materi inti yang ikut disimpan lewat /sync
  // tidak boleh menghabiskan kuota seed AI.
  const countQuery = await db
    .from(LESSONS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("kind", "bonus");
  let total = countQuery.count ?? 0;
  if (countQuery.error) {
    const fallbackCount = await db.from(LESSONS_TABLE).select("id", { count: "exact", head: true });
    total = fallbackCount.count ?? 0;
  }
  if (total >= MAX_BONUS) {
    return NextResponse.json(
      { error: `Tabel sudah berisi ${total} materi bonus (batas ${MAX_BONUS}). Hapus baris lama dulu kalau mau seed lagi.` },
      { status: 409 },
    );
  }
  if (total + topics.length > MAX_BONUS) {
    return NextResponse.json(
      { error: `Melewati batas ${MAX_BONUS} materi bonus (sudah ada ${total}, diminta ${topics.length}).` },
      { status: 409 },
    );
  }

  const results: SeedResult[] = new Array(topics.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < topics.length) {
      const i = cursor++;
      const { topic, level } = topics[i];
      const result = await generateLesson(topic, level, key, chapter);
      if (!result.ok) {
        results[i] = { topic, status: "error", error: result.error };
        continue;
      }
      const lesson = result.lesson;

      // created_at sengaja tidak dikirim: saat insert memakai default now(),
      // saat update baris lama_created_at-nya tidak berubah (urutan tetap).
      const { error } = await db.from(LESSONS_TABLE).upsert(
        {
          id: lesson.id,
          chapter: lesson.chapter,
          title: lesson.title,
          icon: lesson.icon,
          xp: lesson.xp,
          minutes: lesson.minutes,
          boss: lesson.boss ?? false,
          steps: lesson.steps,
          source: lesson.source,
          kind: "bonus",
          track,
          sort_order: 1000 + i,
          level,
        },
        { onConflict: "id" },
      );

      results[i] = error
        ? { topic, status: "error", id: lesson.id, error: error.message }
        : { topic, status: "ok", id: lesson.id, title: lesson.title };
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, topics.length) }, () => worker()));

  const ok = results.filter((r) => r.status === "ok").length;
  return NextResponse.json({ ok, failed: results.length - ok, total, results });
}
