import "server-only";
import type { Lesson, Step } from "./types";

/**
 * Logika generasi materi via Groq.
 * Dipakai oleh /api/admin/seed dan /api/generate.
 * Hanya boleh di-import dari route handler (server) — file ini membaca
 * process.env.GROQ_API_KEY.
 */

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export type Level = "pemula" | "menengah";

export const SYSTEM = `Kamu adalah pembuat materi untuk platform belajar Python bergaya game bernama PyFun.
Balas HANYA dengan satu objek JSON valid (tanpa markdown, tanpa penjelasan) dengan bentuk:
{
  "title": "judul pendek (maks 30 karakter)",
  "icon": "salah satu: Terminal, Package, Calculator, GitBranch, Repeat, List, BookOpen, Braces, Code2, Database, Globe, Type, Sparkles",
  "steps": [
    {"type":"learn","title":"...","body":"penjelasan singkat, pakai \`kode\` untuk inline","code":"contoh kode (opsional)"},
    {"type":"quiz","q":"...","options":["...","...","...","..."],"answer":0,"explain":"..."},
    {"type":"code","prompt":"instruksi jelas","starter":"kode awal (boleh kosong)","out":"output persis yang diharapkan","hint":"petunjuk","solution":"kode jawaban lengkap"}
  ]
}
Aturan:
- Bahasa Indonesia, ramah, singkat. Total 6 sampai 8 langkah: urutan learn, learn, quiz, quiz, code, code (boleh sedikit berbeda).
- Hanya Python 3 standar. Jangan pakai input(), file, jaringan, atau library eksternal.
- Setiap langkah "code" harus punya "solution" yang benar-benar menghasilkan "out" persis saat dijalankan, deterministik (tanpa random/waktu).
- "solution" harus self-contained: berisi SEMUA baris yang dibutuhkan supaya bisa langsung dijalankan dari atas. Jangan andalkan baris yang hanya ada di "starter".
- "starter" boleh tidak lengkap (ada "# TODO"), tapi "solution" harus lengkap dan jalan.
- Di field "starter", "solution", dan "out", tulis baris baru sebagai baris baru sungguhan. JANGAN menulis karakter backslash-n (\\n) — bukan teks "\\n", tapi penanda newline asli.
- Kalau contoh memakai random, panggil random.seed(42) di baris pertama, dan tulis "out" persis seperti yang keluar (tulis 5 angka acak, bukan "...").
- "answer" adalah indeks (mulai 0) dari opsi yang benar. Selalu 4 opsi.`;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Model sering mengirim "\\n" sebagai dua karakter (backslash + n) alih-alih
 * baris baru sungguhan, sehingga kode Python gagal dijalankan. Ubah penanda
 * umum itu menjadi karakter aslinya.
 */
function unescapeText(s: string): string {
  if (!s.includes("\\")) return s;
  return s.replace(/\\([nrt"'\\])/g, (_, c: string) => {
    switch (c) {
      case "n": return "\n";
      case "r": return "\r";
      case "t": return "\t";
      case '"': return '"';
      case "'": return "'";
      case "\\": return "\\";
      default: return `\\${c}`;
    }
  });
}

/** Sama seperti str(), tapi penanda escape teks diuraikan lebih dulu. */
const code = (v: unknown, max: number) => unescapeText(str(v, max)).slice(0, max);

/** Slug stabil dari topik → dipakai sebagai id, supaya seed ulang meng-update baris yang sama. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Bersihkan balasan AI jadi Lesson yang valid. Null kalau tidak bisa dipakai. */
export function sanitizeLesson(raw: unknown, level: Level, id: string, chapter: string): Lesson | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.steps)) return null;

  const steps: Step[] = [];
  for (const s of (r.steps as unknown[]).slice(0, 10)) {
    if (!s || typeof s !== "object") continue;
    const step = s as Record<string, unknown>;

    if (step.type === "learn" && step.body) {
      steps.push({
        type: "learn",
        title: str(step.title, 60) || "Konsep",
        body: str(step.body, 700),
        code: step.code ? str(step.code, 600) : undefined,
      });
    } else if (step.type === "quiz" && Array.isArray(step.options) && step.options.length >= 2) {
      const options = (step.options as unknown[]).slice(0, 4).map((o: unknown) => str(o, 120));
      const answer = Number(step.answer);
      if (Number.isInteger(answer) && answer >= 0 && answer < options.length) {
        steps.push({ type: "quiz", q: str(step.q, 200), options, answer, explain: str(step.explain, 300) });
      }
    } else if (step.type === "code" && step.prompt && step.solution) {
      steps.push({
        type: "code",
        prompt: code(step.prompt, 300),
        starter: code(step.starter, 600),
        out: code(step.out, 400),
        hint: step.hint ? code(step.hint, 200) : undefined,
        solution: code(step.solution, 800),
      });
    }
  }
  if (steps.length < 3) return null;

  return {
    id,
    chapter,
    title: str(r.title, 40) || "Materi baru",
    icon: str(r.icon, 20) || "Sparkles",
    xp: level === "menengah" ? 160 : 120,
    minutes: Math.max(3, Math.min(10, steps.length)),
    steps,
    source: "supabase",
    createdAt: Date.now(),
  };
}

/** Hasil satu percobaan generate: lesson kalau sukses, atau alasan kegagalan. */
export type GenerateResult =
  | { ok: true; lesson: Lesson }
  | { ok: false; error: string };

/**
 * Panggil Groq sekali dan ubah balannya jadi Lesson.
 * Kalau gagal, kembalikan alasan yang bisa dibaca.
 */
export async function generateLesson(
  topic: string,
  level: Level,
  key: string,
  chapter = "Materi Bonus",
): Promise<GenerateResult> {
  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Topik: ${topic}\nTingkat: ${level}\nBuat satu quest.` },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, error: `Tidak bisa menghubungi Groq: ${e instanceof Error ? e.message : "error jaringan"}` };
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) return { ok: false, error: "Batas permintaan Groq tercapai (429). Coba lagi sebentar." };
    if (res.status === 401) return { ok: false, error: "API key Groq tidak valid (401)." };
    return { ok: false, error: `Groq HTTP ${res.status}: ${detail.slice(0, 180)}` };
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) return { ok: false, error: "Groq membalas kosong." };

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false, error: `Balasan Groq bukan JSON: ${text.slice(0, 120)}` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return { ok: false, error: `JSON Groq tidak bisa diparse: ${match[0].slice(0, 120)}` };
  }

  const slug = slugify(topic);
  const id = slug ? `sb-${slug}` : `sb-${Date.now().toString(36)}`;
  const lesson = sanitizeLesson(parsed, level, id, chapter);
  if (!lesson) {
    const steps = (parsed as { steps?: unknown[] })?.steps;
    const n = Array.isArray(steps) ? steps.length : 0;
    return { ok: false, error: `Format langkah tidak valid (${n} langkah, butuh minimal 3 yang sah).` };
  }
  return { ok: true, lesson };
}
