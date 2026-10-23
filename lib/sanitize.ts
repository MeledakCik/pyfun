import type { DebugTest, Lesson, Step } from "./types";

/**
 * Pembersih data bersama untuk semua input yang tidak dipercaya:
 * balasan AI, hasil scraping dokumentasi, localStorage, dan body API.
 *
 * Prinsip:
 * - selalu batasi panjang (code point, bukan byte);
 * - buang karakter kontrol/bidi yang bisa menyamarkan teks;
 * - jangan pernah menghapus `<`/`>` dari kode Python, cukup andalkan React
 *   yang meng-escape teks saat render (tidak ada dangerouslySetInnerHTML);
 * - regex dari data luar harus divalidasi dan dikompilasi dengan try/catch.
 */

export const LIMITS = {
  name: 20,
  topic: 80,
  id: 80,
  title: 60,
  icon: 24,
  chapter: 40,
  track: 40,
  body: 1200,
  prompt: 400,
  code: 4000,
  starter: 2000,
  solution: 4000,
  output: 2000,
  option: 160,
  question: 240,
  explain: 600,
  hint: 240,
  steps: 12,
  tests: 6,
  patterns: 12,
  items: 12,
  pattern: 160,
} as const;

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const BIDI = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const LESSON_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const GENERATED_ID = /^gen-[A-Za-z0-9_-]{1,72}$/;
const INJECTION_PATTERNS = [
  /(?:ignore|abaikan|lupakan|forget)\s+(?:all|semua|previous|sebelumnya|instruction|instruksi|system|assistant|developer)/i,
  /(?:^|\s)(?:system|assistant|developer|user)\s*:/i,
  /<\s*\/?(?:script|iframe|svg|object|embed|style)\b/i,
  /(?:javascript:|data:text\/html|vbscript:|onerror=|onload=|onmouseover=)/i,
  /(?:reveal|tampilkan|buka|show)\s+(?:the\s+)?(?:prompt|secret|password|rahasia|instruksi|api key|key)/i,
  /(?:act as|berperan sebagai|jadi|you are now|kamu sekarang)/i,
  /(?:jailbreak|prompt[- ]injection|override|mengabaikan perintah)/i,
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function looksLikePromptInjection(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(normalized)) return true;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Potong berdasarkan code point supaya pasangan surrogate tidak rusak. */
export function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  return Array.from(value).slice(0, max).join("");
}

/** Teks biasa: kontrol/bidi dibuang, newline dirapikan. */
export function cleanText(value: unknown, max: number, multiline = false): string {
  if (typeof value !== "string") return "";
  let text = value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(BIDI, "");
  if (!multiline) text = text.replace(/[\n\t]+/g, " ");
  return clampText(text.trim(), max);
}

/** Nama panggilan: hanya huruf/angka, spasi, titik, garis bawah, strip. */
export function cleanName(value: unknown, max = LIMITS.name): string {
  if (typeof value !== "string") return "";
  if (looksLikePromptInjection(value)) return "";
  return clampText(
    value
      .normalize("NFKC")
      .replace(CONTROL, "")
      .replace(BIDI, "")
      .replace(/[^\p{L}\p{N} ._-]/gu, "")
      .replace(/\s+/g, " ")
      .trim(),
    max,
  );
}

/** Topik: satu baris, spasi dirapikan, tanpa karakter kontrol. */
export function cleanTopic(value: unknown, max = LIMITS.topic): string {
  const topic = cleanText(value, max * 2).replace(/\s+/g, " ").trim();
  if (!topic || looksLikePromptInjection(topic)) return "";
  return clampText(topic, max);
}

/** Kode: newline & tab dipertahankan, karakter kontrol lain dibuang. */
export function cleanCode(value: unknown, max: number = LIMITS.code): string {
  if (typeof value !== "string") return "";
  return clampText(
    value
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
      .replace(BIDI, ""),
    max,
  );
}

export function validLessonId(value: unknown): value is string {
  return typeof value === "string" && LESSON_ID.test(value);
}

/**
 * Validasi pola regex dari data luar. Pola yang terlalu panjang, mengandung
 * karakter kontrol, atau tidak bisa dikompilasi akan ditolak (null).
 * Ini juga menolak konstruksi yang tidak pernah dipakai materi PyFun,
 * misalnya backreference dan inline flag, agar permukaan ReDoS menyempit.
 */
export function cleanPattern(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const pattern = value.trim();
  if (!pattern || pattern.length > LIMITS.pattern) return null;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(pattern)) return null;
  // `<`/`>` tidak pernah dibutuhkan oleh pola materi, dan menghindari pola
  // yang mencoba menyisipkan markup bila suatu saat ditampilkan tanpa escape.
  if (pattern.includes("<") || pattern.includes(">")) return null;
  try {
    // eslint-disable-next-line no-new
    new RegExp(pattern);
  } catch {
    return null;
  }
  return pattern;
}

export function compilePattern(pattern: string): RegExp | null {
  const safe = cleanPattern(pattern);
  if (!safe) return null;
  try {
    return new RegExp(safe);
  } catch {
    return null;
  }
}

export function sanitizeStringList(value: unknown, maxItems: number = LIMITS.items, maxLength: number = LIMITS.option): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => cleanText(item, maxLength))
    .filter((item) => item.length > 0);
}

function sanitizeDebugTests(value: unknown): DebugTest[] {
  if (!Array.isArray(value)) return [];
  const tests: DebugTest[] = [];
  for (const raw of value.slice(0, LIMITS.tests)) {
    if (!isRecord(raw)) continue;
    const code = cleanCode(raw.code, LIMITS.code);
    const expected = cleanText(raw.expected, LIMITS.output, true);
    if (!code || !expected) continue;
    const label = cleanText(raw.label, LIMITS.option);
    tests.push({ ...(label ? { label } : {}), code, expected });
  }
  return tests;
}

/**
 * Ubah langkah mentah menjadi Step yang aman dan konsisten. Langkah yang
 * tidak punya field wajib akan dibuang, bukan dipaksa menjadi data setengah.
 */
export function sanitizeSteps(value: unknown, options: { maxSteps?: number; requireSolutions?: boolean } = {}): Step[] {
  if (!Array.isArray(value)) return [];
  const steps: Step[] = [];
  const maxSteps = Math.min(options.maxSteps ?? LIMITS.steps, LIMITS.steps);

  for (const raw of value.slice(0, maxSteps)) {
    if (!isRecord(raw)) continue;

    if (raw.type === "learn") {
      const body = cleanText(raw.body, LIMITS.body, true);
      if (!body) continue;
      const code = raw.code ? cleanCode(raw.code, LIMITS.code) : "";
      steps.push({
        type: "learn",
        title: cleanText(raw.title, LIMITS.title) || "Konsep",
        body,
        ...(code ? { code } : {}),
      });
      continue;
    }

    if (raw.type === "quiz") {
      if (!Array.isArray(raw.options)) continue;
      const options = raw.options
        .slice(0, 4)
        .map((option) => cleanText(option, LIMITS.option))
        .filter((option) => option.length > 0);
      if (options.length < 2) continue;
      const answer = Number(raw.answer);
      if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
      const wrong = Array.isArray(raw.wrong)
        ? options.map((_, index) => cleanText((raw.wrong as unknown[])[index], LIMITS.explain))
        : [];
      steps.push({
        type: "quiz",
        q: cleanText(raw.q, LIMITS.question),
        options,
        answer,
        explain: cleanText(raw.explain, LIMITS.explain),
        ...(wrong.some((reason) => reason.length > 0) ? { wrong } : {}),
      });
      continue;
    }

    if (raw.type === "code") {
      const prompt = cleanText(raw.prompt, LIMITS.prompt);
      const starter = cleanCode(raw.starter, Math.max(LIMITS.starter, 20_000));
      const solution = raw.solution ? cleanCode(raw.solution, LIMITS.solution) : "";
      if (!prompt || (options.requireSolutions && !solution)) continue;
      const need = sanitizeStringList(raw.need, LIMITS.patterns, LIMITS.pattern)
        .map(cleanPattern)
        .filter((pattern): pattern is string => !!pattern);
      const has = sanitizeStringList(raw.has, LIMITS.items, Math.max(LIMITS.output, 20_000) as number);
      const chips = sanitizeStringList(raw.chips, LIMITS.items, LIMITS.option);
      const hint = cleanText(raw.hint, LIMITS.hint);
      const hint2 = cleanText(raw.hint2, LIMITS.hint);
      const out = raw.out === undefined ? undefined : cleanText(raw.out, LIMITS.output, true);
      steps.push({
        type: "code",
        prompt,
        starter,
        ...(out !== undefined ? { out } : {}),
        ...(has.length > 0 ? { has } : {}),
        ...(need.length > 0 ? { need } : {}),
        ...(chips.length > 0 ? { chips } : {}),
        ...(hint ? { hint } : {}),
        ...(hint2 ? { hint2 } : {}),
        ...(solution ? { solution } : {}),
      });
      continue;
    }

    if (raw.type === "predict") {
      const code = cleanCode(raw.code, LIMITS.code);
      if (!code) continue;
      const hint = cleanText(raw.hint, LIMITS.hint);
      const hint2 = cleanText(raw.hint2, LIMITS.hint);
      const explain = cleanText(raw.explain, LIMITS.explain);
      steps.push({
        type: "predict",
        prompt: cleanText(raw.prompt, LIMITS.prompt) || "Tebak output kode ini.",
        code,
        ...(hint ? { hint } : {}),
        ...(hint2 ? { hint2 } : {}),
        ...(explain ? { explain } : {}),
      });
      continue;
    }

    if (raw.type === "debug") {
      const starter = cleanCode(raw.starter, LIMITS.code);
      const tests = sanitizeDebugTests(raw.tests);
      const solution = raw.solution ? cleanCode(raw.solution, LIMITS.solution) : "";
      if (!starter || tests.length === 0 || (options.requireSolutions && !solution)) continue;
      const hint = cleanText(raw.hint, LIMITS.hint);
      const hint2 = cleanText(raw.hint2, LIMITS.hint);
      steps.push({
        type: "debug",
        prompt: cleanText(raw.prompt, LIMITS.prompt) || "Perbaiki bug pada kode ini.",
        starter,
        tests,
        ...(hint ? { hint } : {}),
        ...(hint2 ? { hint2 } : {}),
        ...(solution ? { solution } : {}),
      });
    }
  }

  return steps;
}

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
};

/** Validasi materi buatan user yang dibaca dari localStorage atau akan disimpan. */
export function sanitizeGeneratedLesson(value: unknown): Lesson | null {
  if (!isRecord(value) || value.source !== "generated") return null;
  if (typeof value.id !== "string" || !GENERATED_ID.test(value.id)) return null;

  const steps = sanitizeSteps(value.steps, { maxSteps: LIMITS.steps });
  if (steps.length === 0) return null;

  const level = value.level === "menengah" || value.level === "lanjutan" ? value.level : "pemula";
  const createdAt = Number(value.createdAt);

  return {
    id: value.id,
    chapter: "Materi Saya",
    title: cleanText(value.title, LIMITS.title) || "Materi baru",
    icon: cleanText(value.icon, LIMITS.icon) || "Sparkles",
    xp: clampInt(value.xp, 10, 500, 120),
    minutes: clampInt(value.minutes, 1, 60, 5),
    boss: false,
    steps,
    source: "generated",
    track: "Materi Saya",
    level,
    ...(Number.isFinite(createdAt) && createdAt > 0 ? { createdAt } : {}),
  };
}
