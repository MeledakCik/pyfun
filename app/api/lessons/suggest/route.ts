import "server-only";
import { NextResponse } from "next/server";
import { BONUS_CATALOG } from "@/lib/bonus";
import { BUNDLED } from "@/lib/lessons";
import { bodyTooLarge } from "@/lib/rate-limit";
import { validLessonId } from "@/lib/sanitize";
import { CROSS_ORIGIN_ERROR, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";

const MAX_BODY = 8 * 1024;
const MAX_IDS = 200;
const FALLBACK_TOPICS = [
  "Generator & yield",
  "Decorator sederhana",
  "Context manager",
  "Async/await dasar",
  "Unit test dengan unittest",
  "SQLite dasar",
  "Pipeline CSV & JSON",
  "Typing & dataclass",
  "Packaging modul Python",
  "Profil performa sederhana",
];

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Saran topik ditentukan dari katalog lokal, bukan panggilan AI, supaya
 * endpoint ini murah dan tidak menambah kuota generate.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return json({ error: CROSS_ORIGIN_ERROR }, 403);
  }
  if (bodyTooLarge(req, MAX_BODY)) {
    return json({ error: "Body permintaan terlalu besar." }, 413);
  }

  const raw = await req.text().catch(() => "");
  if (raw.length > MAX_BODY) {
    return json({ error: "Body permintaan terlalu besar." }, 413);
  }
  if (!raw) return json({ error: "Body JSON wajib diisi." }, 400);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Body bukan JSON yang valid." }, 400);
  }

  const b = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(b.completedIds) || b.completedIds.length > MAX_IDS) {
    return json({ error: "completedIds harus berupa array maksimal 200 id." }, 400);
  }

  const completed = new Set<string>();
  for (const id of b.completedIds) {
    if (typeof id !== "string") {
      return json({ error: "completedIds hanya boleh berisi string." }, 400);
    }
    // Hanya ID materi yang bentuknya sah yang boleh memengaruhi saran.
    if (!validLessonId(id)) continue;
    const clean = id.trim();
    if (clean) completed.add(clean);
  }

  const topics: string[] = [];
  const seen = new Set<string>();

  for (const lesson of [...BUNDLED, ...BONUS_CATALOG]) {
    if (completed.has(lesson.id) || seen.has(lesson.title)) continue;
    seen.add(lesson.title);
    topics.push(lesson.title);
    if (topics.length === 5) break;
  }

  for (const topic of FALLBACK_TOPICS) {
    if (topics.length === 5) break;
    if (seen.has(topic)) continue;
    seen.add(topic);
    topics.push(topic);
  }

  return json({ topics });
}
