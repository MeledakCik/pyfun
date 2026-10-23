import "server-only";
import { NextResponse } from "next/server";
import type { LearnStep, Lesson } from "@/lib/types";
import { bodyTooLarge, clientIp, rateLimit } from "@/lib/rate-limit";
import { cleanTopic } from "@/lib/sanitize";
import { CROSS_ORIGIN_ERROR, isSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_BODY = 8 * 1024;
const PER_IP_HOURLY = 30;
const DOCS_ID_BASE = "https://docs.python.org/id/3/";
const DOCS_EN_BASE = "https://docs.python.org/3/";
const USER_AGENT = "PyFun/1.0 (educational Python lessons)";

type DocTarget = {
  page: string;
  section?: string;
  keywords: string[];
};

/**
 * Peta topik ke halaman tutorial resmi Python. Section adalah anchor di
 * dokumentasi; kalau section tidak ada, materi diambil dari awal halaman.
 */
const TARGETS: DocTarget[] = [
  { page: "tutorial/introduction.html", section: "numbers", keywords: ["angka", "number", "numbers", "aritmatika", "operator", "operators", "hitung", "matematika"] },
  { page: "tutorial/introduction.html", section: "text", keywords: ["string", "strings", "teks", "text", "kutip"] },
  { page: "tutorial/introduction.html", section: "lists", keywords: ["list dasar", "daftar dasar"] },
  { page: "tutorial/introduction.html", section: "first-steps-towards-programming", keywords: ["while", "variabel", "variable", "variables", "assignment", "input"] },
  { page: "tutorial/controlflow.html", section: "if-statements", keywords: ["if", "else", "elif", "kondisi", "percabangan", "conditional"] },
  { page: "tutorial/controlflow.html", section: "for-statements", keywords: ["for", "loop", "loops", "perulangan", "iterasi"] },
  { page: "tutorial/controlflow.html", section: "the-range-function", keywords: ["range"] },
  { page: "tutorial/controlflow.html", section: "break-and-continue-statements", keywords: ["break", "continue"] },
  { page: "tutorial/controlflow.html", section: "defining-functions", keywords: ["fungsi", "function", "functions", "def", "return", "parameter", "argumen"] },
  { page: "tutorial/controlflow.html", section: "lambda-expressions", keywords: ["lambda"] },
  { page: "tutorial/controlflow.html", section: "match-statements", keywords: ["match", "switch"] },
  { page: "tutorial/datastructures.html", keywords: ["struktur data", "data structure", "data structures"] },
  { page: "tutorial/datastructures.html", section: "list-comprehensions", keywords: ["list comprehension", "comprehension", "pemahaman daftar"] },
  { page: "tutorial/datastructures.html", section: "more-on-lists", keywords: ["list", "lists", "daftar", "append", "pop", "sort"] },
  { page: "tutorial/datastructures.html", section: "tuples-and-sequences", keywords: ["tuple", "tuples", "sequence", "unpacking"] },
  { page: "tutorial/datastructures.html", section: "sets", keywords: ["set", "sets", "himpunan"] },
  { page: "tutorial/datastructures.html", section: "dictionaries", keywords: ["dict", "dicts", "dictionary", "kamus"] },
  { page: "tutorial/datastructures.html", section: "looping-techniques", keywords: ["enumerate", "zip", "looping techniques"] },
  { page: "tutorial/modules.html", keywords: ["modul", "module", "modules", "import", "package", "packages", "paket"] },
  { page: "tutorial/inputoutput.html", section: "formatted-string-literals", keywords: ["f-string", "fstring", "format string", "formatted string"] },
  { page: "tutorial/inputoutput.html", section: "reading-and-writing-files", keywords: ["file", "files", "berkas", "open", "baca tulis", "write file"] },
  { page: "tutorial/inputoutput.html", section: "saving-structured-data-with-json", keywords: ["json"] },
  { page: "tutorial/errors.html", section: "handling-exceptions", keywords: ["error", "errors", "exception", "exceptions", "try", "except", "pengecualian", "raise"] },
  { page: "tutorial/classes.html", section: "a-first-look-at-classes", keywords: ["class", "classes", "kelas", "oop", "objek", "object", "objects"] },
  { page: "tutorial/classes.html", section: "inheritance", keywords: ["inheritance", "pewarisan", "inherit"] },
  { page: "tutorial/stdlib.html", keywords: ["standard library", "pustaka standar", "os", "sys", "math", "random", "datetime", "re", "regex"] },
  { page: "tutorial/venv.html", keywords: ["venv", "virtual environment", "pip", "install", "virtualenv"] },
  { page: "tutorial/interpreter.html", keywords: ["interpreter", "repl", "shell", "terminal"] },
];

const DEFAULT_TARGET: DocTarget = { page: "tutorial/introduction.html", keywords: [] };

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });

function normalizeTopic(value: unknown): string {
  return cleanTopic(value);
}

function keywordScore(text: string, keyword: string): number {
  // Batasi kata pendek agar "for" tidak cocok dengan "before" dan "set"
  // tidak cocok dengan "dataset".
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu");
  if (!pattern.test(text)) return 0;
  // Frase yang lebih spesifik menang atas kata tunggal.
  return keyword.length + (keyword.includes(" ") ? 10 : 0);
}

function pickTarget(topic: string): DocTarget {
  const text = topic.toLocaleLowerCase("id-ID");
  let best: { target: DocTarget; score: number } | null = null;

  for (const target of TARGETS) {
    for (const keyword of target.keywords) {
      const score = keywordScore(text, keyword);
      if (score === 0) continue;
      if (!best || score > best.score) best = { target, score };
    }
  }

  return best?.target ?? DEFAULT_TARGET;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)));
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div|h[1-6]|pre|dt|dd)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/¶/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(value: string, max: number): string {
  // Potong berdasarkan code point agar pasangan surrogate tidak terbelah.
  const chars = Array.from(value);
  if (chars.length <= max) return value;
  const cut = chars.slice(0, max).join("");
  const at = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  return `${cut.slice(0, at > 0 ? at : cut.length).trim()}…`;
}

type ParsedSection = {
  id: string;
  title: string;
  body: string;
  code?: string;
};

type ParsedPage = {
  title: string;
  sections: ParsedSection[];
  url: string;
};

function parseDocsPage(html: string, url: string): ParsedPage {
  const bodyMatch =
    html.match(/<div class="body" role="main">([\s\S]*?)<div class="clearer">/i) ??
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!bodyMatch) throw new Error("Bagian utama dokumentasi tidak ditemukan.");

  const body = bodyMatch[1]
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ");

  const tokenRe = /<(h[1-3]|p|li|dt|pre)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  const sections: ParsedSection[] = [];
  let pageTitle = "";
  let current: ParsedSection | null = null;

  const finalize = () => {
    if (current && (current.body || current.code)) sections.push(current);
  };

  for (const match of body.matchAll(tokenRe)) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const inner = match[3];
    const text = htmlToText(inner);

    if (tag === "h1") {
      finalize();
      pageTitle = text;
      const id = attrs.match(/\bid="([^"]+)"/i)?.[1] ?? inner.match(/href="#([^"]+)"/i)?.[1] ?? "";
      current = { id, title: text, body: "" };
      continue;
    }

    if (tag === "h2" || tag === "h3") {
      finalize();
      const id = attrs.match(/\bid="([^"]+)"/i)?.[1] ?? inner.match(/href="#([^"]+)"/i)?.[1] ?? "";
      current = { id, title: text, body: "" };
      continue;
    }

    if (!current) current = { id: "", title: pageTitle, body: "" };

    if (tag === "pre") {
      if (text && !current.code) current.code = truncate(text, 900);
    } else if (text) {
      current.body = current.body ? `${current.body}\n\n${text}` : text;
    }
  }

  finalize();
  if (!pageTitle) pageTitle = sections[0]?.title ?? "Dokumentasi Python";

  return { title: pageTitle, sections, url };
}

async function fetchDocs(target: DocTarget): Promise<ParsedPage> {
  const urls = [
    new URL(target.page, DOCS_ID_BASE).toString(),
    new URL(target.page, DOCS_EN_BASE).toString(),
  ];
  let lastError: unknown;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8_000),
        cache: "force-cache",
      });
      if (!res.ok) {
        lastError = new Error(`Dokumentasi membalas ${res.status}.`);
        continue;
      }
      const html = await res.text();
      return parseDocsPage(html, url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Dokumentasi Python tidak dapat diakses.");
}

function buildLesson(
  topic: string,
  level: "pemula" | "menengah",
  target: DocTarget,
  page: ParsedPage,
): Lesson {
  const start = target.section
    ? page.sections.findIndex((section) => section.id === target.section)
    : -1;
  const candidates = start >= 0 ? page.sections.slice(start) : page.sections;
  const selected = candidates
    .filter((section) => section.body.length >= 30 || !!section.code)
    .slice(0, 3);

  const steps: LearnStep[] = selected.map((section) => ({
    type: "learn",
    title: section.title || page.title || "Dokumentasi Python",
    body: truncate(section.body || "Contoh kode dari dokumentasi Python.", 900),
    ...(section.code ? { code: section.code } : {}),
  }));

  if (steps.length === 0) {
    throw new Error("Isi dokumentasi tidak cukup untuk dijadikan materi.");
  }

  if (steps.length < 2) {
    steps.unshift({
      type: "learn",
      title: "Tentang materi ini",
      body: `Materi ini diambil dari dokumentasi resmi Python untuk topik "${topic}". Baca langkah berikut, lalu buka tautan sumber untuk penjelasan lengkap.`,
    });
  }

  steps.push({
    type: "learn",
    title: "Sumber resmi",
    body: `Materi ini diambil langsung dari dokumentasi resmi Python:\n\n${page.url}\n\nBuka halaman tersebut untuk membaca penjelasan lengkap, contoh tambahan, dan tautan ke topik terkait.`,
  });

  const slug = topic
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "materi";

  return {
    id: `doc-${slug}`,
    chapter: "Materi Saya",
    title: truncate(`Dokumentasi: ${topic}`, 60),
    icon: "BookOpen",
    xp: level === "menengah" ? 120 : 80,
    minutes: Math.max(4, Math.min(10, steps.length + 2)),
    boss: false,
    steps,
    source: "docs",
    track: "Materi Saya",
    level,
    createdAt: Date.now(),
  };
}

function fallbackLesson(topic: string, level: "pemula" | "menengah", target: DocTarget): Lesson {
  const url = new URL(target.page, DOCS_ID_BASE).toString();
  const steps: LearnStep[] = [
    {
      type: "learn",
      title: "Materi dari dokumentasi Python",
      body: `Topik: ${topic}\n\nMateri ini diambil dari dokumentasi resmi Python. Halaman dokumentasi sedang tidak dapat dimuat saat ini, jadi ringkasan ini membantu kamu mulai. Buka tautan sumber di langkah terakhir untuk membaca penjelasan lengkap.`,
    },
    {
      type: "learn",
      title: "Cara belajar",
      body: `1. Buka tautan dokumentasi resmi di langkah berikutnya.\n\n2. Cari bagian yang sesuai dengan topik "${topic}".\n\n3. Salin contoh kode ke Playground dan jalankan untuk melihat hasilnya.`,
    },
    {
      type: "learn",
      title: "Sumber resmi",
      body: `Dokumentasi Python:\n\n${url}\n\nMateri ini adalah ringkasan bacaan; penjelasan lengkap ada di halaman aslinya.`,
    },
  ];

  const slug = topic
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "materi";

  return {
    id: `doc-${slug}`,
    chapter: "Materi Saya",
    title: truncate(`Dokumentasi: ${topic}`, 60),
    icon: "BookOpen",
    xp: level === "menengah" ? 120 : 80,
    minutes: 5,
    boss: false,
    steps,
    source: "docs",
    track: "Materi Saya",
    level,
    createdAt: Date.now(),
  };
}

export async function POST(req: Request) {
  try {
    if (!isSameOrigin(req)) {
      return json({ error: CROSS_ORIGIN_ERROR }, 403);
    }
    if (bodyTooLarge(req, MAX_BODY)) {
      return json({ error: "Body permintaan terlalu besar." }, 413);
    }

    const limit = rateLimit(`docs:${clientIp(req)}`, PER_IP_HOURLY, 60 * 60 * 1000);
    if (!limit.ok) {
      return json(
        { error: "Terlalu banyak permintaan materi. Coba lagi sebentar." },
        429,
        { "Retry-After": String(limit.retryAfter) },
      );
    }

    const raw = await req.text().catch(() => "");
    if (!raw) return json({ error: "Body JSON wajib diisi." }, 400);
    if (raw.length > MAX_BODY) return json({ error: "Body permintaan terlalu besar." }, 413);

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

    const level = b.level === "menengah" ? "menengah" : "pemula";
    const target = pickTarget(topic);

    try {
      const page = await fetchDocs(target);
      return json({ lesson: buildLesson(topic, level, target, page), fallback: false });
    } catch (error) {
      console.error("lessons/docs fetch failed", error);
      // Tetap beri materi bacaan + tautan sumber; jangan pernah menampilkan
      // error AI hanya karena dokumentasi sedang lambat.
      return json({ lesson: fallbackLesson(topic, level, target), fallback: true });
    }
  } catch (error) {
    console.error("lessons/docs failed", error);
    return json({ error: "Materi dokumentasi belum bisa disiapkan. Coba lagi sebentar." }, 500);
  }
}
