import "server-only";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";
import { bodyTooLarge, clientIp, rateLimit } from "@/lib/rate-limit";
import { LESSONS_TABLE } from "@/lib/supabase";
import { BUNDLED } from "@/lib/lessons";
import { BONUS_CATALOG } from "@/lib/bonus";
import type { Lesson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHUNK = 40;
const MAX_BODY = 2 * 1024;

type Mode = "all" | "core" | "bonus";

type Row = {
  id: string;
  chapter: string;
  title: string;
  icon: string;
  xp: number;
  minutes: number;
  boss: boolean;
  steps: Lesson["steps"];
  source: string;
  kind: "core" | "bonus";
  track: string;
  sort_order: number;
  level: string;
};

function coreRow(lesson: Lesson, index: number): Row {
  return {
    id: lesson.id,
    chapter: lesson.chapter,
    title: lesson.title,
    icon: lesson.icon,
    xp: lesson.xp,
    minutes: lesson.minutes,
    boss: lesson.boss ?? false,
    steps: lesson.steps,
    source: "bundled",
    kind: "core",
    track: lesson.chapter,
    sort_order: index,
    level: lesson.level ?? "pemula",
  };
}

function bonusRow(lesson: Lesson, index: number): Row {
  return {
    id: lesson.id,
    chapter: lesson.chapter,
    title: lesson.title,
    icon: lesson.icon,
    xp: lesson.xp,
    minutes: lesson.minutes,
    boss: lesson.boss ?? false,
    steps: lesson.steps,
    source: lesson.source === "catalog" ? "catalog" : "supabase",
    kind: "bonus",
    track: lesson.track ?? "Fondasi Bonus",
    sort_order: lesson.sortOrder ?? index,
    level: lesson.level ?? "pemula",
  };
}

function parseMode(body: unknown): Mode {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (raw.mode === "core" || raw.mode === "bonus") return raw.mode;
  return "all";
}

/**
 * Simpan seluruh materi terkurasi (inti + bonus) ke Supabase.
 * POST /api/admin/sync dengan header x-admin-secret.
 *
 * Tidak memakai Groq, jadi aman dijalankan tanpa biaya AI. Materi inti tetap
 * dibundel di app sebagai fallback offline; endpoint ini membuat salinan
 * terpusat di Supabase agar semua materi juga tersimpan di database.
 */
export async function POST(req: Request) {
  const limited = rateLimit(`sync:${clientIp(req)}`, 3, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi sebentar." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (bodyTooLarge(req, MAX_BODY)) {
    return NextResponse.json({ error: "Body permintaan terlalu besar." }, { status: 413 });
  }

  const db = adminClient();
  if (!db) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY tidak ada di environment. Ambil dari Supabase Dashboard → Project Settings → API." },
      { status: 500 },
    );
  }

  const raw = await req.text().catch(() => "");
  if (raw.length > MAX_BODY) {
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

  const mode = parseMode(body);
  const core = mode === "bonus" ? [] : BUNDLED.map(coreRow);
  const bonus = mode === "core" ? [] : BONUS_CATALOG.map(bonusRow);
  const rows = [...core, ...bonus];

  if (rows.length === 0) {
    return NextResponse.json({ error: "Tidak ada materi yang disinkronkan." }, { status: 400 });
  }

  let synced = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await db.from(LESSONS_TABLE).upsert(chunk, { onConflict: "id" });
    if (error) {
      return NextResponse.json(
        { error: `Gagal sync ke Supabase: ${error.message}`, synced },
        { status: 500 },
      );
    }
    synced += chunk.length;
  }

  return NextResponse.json({
    ok: true,
    mode,
    core: core.length,
    bonus: bonus.length,
    synced,
    message: "Materi inti + bonus tersimpan di Supabase. Materi inti tetap memakai bundel lokal sebagai fallback.",
  });
}
