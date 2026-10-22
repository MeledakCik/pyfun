import "server-only";
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import {
  checkPythonTopic,
  generateLesson,
  hasDangerousCode,
  sanitizeLesson,
  type Level,
  type RepairContext,
} from "@/lib/ai";
import { adminClient } from "@/lib/supabase-admin";
import { bodyTooLarge, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Cukup untuk topik biasa maupun draft perbaikan yang membawa langkah-langkah.
const MAX_BODY = 64 * 1024;
const PER_IP_DAILY = 10;
const GLOBAL_DAILY = Math.max(1, Math.min(1000, Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 100));
const HASH_SALT =
  process.env.AI_RATE_LIMIT_SALT ||
  process.env.ADMIN_SEED_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "";

type QuotaRow = {
  allowed: boolean;
  reason: string;
  remaining: number;
  retry_after: number;
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });

/** Topik hanya berupa teks biasa: kontrol dihapus, whitespace dirapikan. */
function normalizeTopic(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\p{Cc}/gu, "").replace(/\s+/g, " ").trim();
}

export async function POST(req: Request) {
  try {
    if (bodyTooLarge(req, MAX_BODY)) {
      return json({ error: "Body permintaan terlalu besar." }, 413);
    }

    const raw = await req.text().catch(() => "");
    if (raw.length > MAX_BODY) {
      return json({ error: "Body permintaan terlalu besar." }, 413);
    }
    if (!raw) {
      return json({ error: "Body JSON wajib diisi." }, 400);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Body bukan JSON yang valid." }, 400);
    }

    const b = (body ?? {}) as Record<string, unknown>;
    const topic = normalizeTopic(b.topic);
    const topicLength = Array.from(topic).length;
    if (topicLength < 3 || topicLength > 80) {
      return json({ error: "Topik harus 3-80 karakter." }, 400);
    }

    const level: Level = b.level === "menengah" ? "menengah" : "pemula";

    // Client boleh mengirim draft + masalah validasi Pyodide untuk diperbaiki.
    // Draft tidak pernah dipercaya mentah; ia disanitasi ulang sebelum masuk prompt.
    let repair: RepairContext | undefined;
    if (b.repair && typeof b.repair === "object") {
      const r = b.repair as Record<string, unknown>;
      const errors = Array.isArray(r.errors)
        ? r.errors
            .filter((error): error is string => typeof error === "string")
            .slice(0, 6)
            .map((error) => error.replace(/\p{Cc}/gu, "").slice(0, 500))
        : [];
      if (errors.length > 0) {
        repair = {
          attempt: Math.min(2, Math.max(1, Number(r.attempt) || 1)),
          errors,
          previous: sanitizeLesson(r.lesson, level, "repair", "Materi Saya") ?? undefined,
        };
      }
    }

    const key = process.env.GROQ_API_KEY || "";
    const db = adminClient();
    if (!key || !db || !HASH_SALT) {
      return json({ error: "Layanan AI belum tersedia." }, 503);
    }

    // Simpan hanya hash IP, bukan IP mentah, agar kuota tidak membocorkan alamat.
    const ipHash = createHmac("sha256", HASH_SALT).update(clientIp(req)).digest("hex");
    const quota = await db.rpc("consume_pyfun_ai_quota", {
      p_ip_hash: ipHash,
      p_ip_limit: PER_IP_DAILY,
      p_global_limit: GLOBAL_DAILY,
    });

    if (quota.error) {
      console.error("consume_pyfun_ai_quota failed", quota.error.message);
      return json({ error: "Layanan AI belum tersedia." }, 503);
    }

    const row = (Array.isArray(quota.data) ? quota.data[0] : quota.data) as QuotaRow | undefined;
    if (!row) {
      return json({ error: "Layanan AI belum tersedia." }, 503);
    }
    if (!row.allowed) {
      const retryAfter = Math.max(1, Number(row.retry_after) || 1);
      const message =
        row.reason === "global"
          ? "Kuota AI hari ini sudah habis. Coba lagi besok."
          : "Batas 10 generate per hari tercapai. Coba lagi besok.";
      return json({ error: message }, 429, { "Retry-After": String(retryAfter) });
    }

    // Satu panggilan singkat untuk menolak topik yang jelas bukan Python.
    const topicCheck = await checkPythonTopic(topic, key);
    if (!topicCheck.ok) {
      return json({ error: "Layanan AI sedang sibuk. Coba lagi sebentar." }, 502);
    }
    if (!topicCheck.isPython) {
      return json({ error: "Topik belum dikenali sebagai topik Python." }, 422);
    }

    const result = await generateLesson(topic, level, key, "Materi Saya", repair);
    if (!result.ok) {
      return json({ error: "Materi gagal dibuat. Coba topik lain." }, 502);
    }

    // Filter ini bukan sandbox; tujuannya menolak contoh kode yang jelas berbahaya.
    if (hasDangerousCode(result.lesson)) {
      return json({ error: "Materi tidak lolos validasi keamanan. Coba topik lain." }, 422);
    }

    return json({
      lesson: result.lesson,
      quota: { remaining: Math.max(0, Number(row.remaining) || 0) },
    });
  } catch (error) {
    console.error("lessons/generate failed", error);
    return json({ error: "Terjadi kesalahan. Coba lagi sebentar." }, 500);
  }
}
