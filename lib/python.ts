"use client";
import { compilePattern, LIMITS } from "./sanitize";
import type { CodeStep, Lesson } from "./types";

/**
 * Menjalankan Python di browser lewat Pyodide dalam Web Worker.
 * Worker dibuat dari Blob supaya tidak butuh file tambahan, dan bisa
 * dimatikan paksa kalau kode pengguna berputar tanpa henti (timeout).
 */
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const MAX_SOURCE = 20_000;
const MAX_OUTPUT = 60_000;

/**
 * Filter awal sebelum kode dikirim ke Pyodide. Pyodide berjalan di Web Worker
 * tanpa akses DOM/jaringan, tetapi modul seperti `js`/`pyodide_js` bisa
 * menjembatani JavaScript. Blokir modul tersebut dan primitif escape yang
 * tidak dibutuhkan materi. Ini bukan sandbox sempurna—timeout worker tetap
 * menjadi lapisan terakhir.
 */
const BLOCKED_IMPORT =
  /(?:^|[;\n:])\s*(?:import|from)\s+(?:os|sys|subprocess|socket|urllib|http|ftplib|ctypes|importlib|builtins|shutil|js|pyodide|pyodide_js|micropip)\b/;
const BLOCKED_CALL = /\b(?:eval|exec|compile|__import__|breakpoint)\s*\(|__builtins__|\bgetattr\s*\(\s*__builtins__/;

export function unsafeCodeReason(source: string): string | null {
  if (source.length > MAX_SOURCE) return "Kode terlalu panjang (maksimal 20.000 karakter).";
  if (BLOCKED_IMPORT.test(source) || BLOCKED_CALL.test(source)) {
    return "Kode memakai modul atau fungsi yang tidak diizinkan di playground.";
  }
  return null;
}

const WORKER_SRC = `
let ready;
try {
  importScripts("${PYODIDE}pyodide.js");
  ready = loadPyodide({ indexURL: "${PYODIDE}" });
} catch (err) {
  ready = Promise.reject(err);
}
ready.then(
  () => self.postMessage({ ready: true }),
  () => self.postMessage({ fatal: true }),
);
self.onmessage = async (e) => {
  const { id, code } = e.data;
  let py;
  try { py = await ready; } catch { return; }
  let out = "";
  let truncated = false;
  const push = (s) => {
    if (out.length >= ${MAX_OUTPUT}) { truncated = true; return; }
    out += String(s).slice(0, ${MAX_OUTPUT} - out.length) + "\\n";
  };
  py.setStdout({ batched: push });
  py.setStderr({ batched: push });
  try {
    await py.runPythonAsync(code);
    self.postMessage({ id, ok: true, out: truncated ? out + "[output dipotong]" : out });
  } catch (err) {
    const lines = String(err.message || err).trim().split("\\n");
    const at = lines.findIndex((l) => l.includes('File "<exec>"'));
    self.postMessage({ id, ok: false, out, error: lines.slice(Math.max(0, at)).join("\\n") });
  }
};
`;

type Engine = { w: Worker; ready: Promise<boolean> };
let engine: Engine | null = null;
let seq = 0;

function spawn(): Engine {
  const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" }));
  const w = new Worker(url);
  const ready = new Promise<boolean>((resolve) => {
    const on = (e: MessageEvent) => {
      if (e.data.ready) resolve(true);
      else if (e.data.fatal) resolve(false);
      else return;
      w.removeEventListener("message", on);
    };
    w.addEventListener("message", on);
    w.addEventListener("error", () => resolve(false));
  });
  engine = { w, ready };
  return engine;
}

function kill() {
  engine?.w.terminate();
  engine = null;
}

/** Panggil lebih awal (mis. saat membuka halaman) agar run pertama terasa cepat. */
export function warmUp() {
  if (typeof window !== "undefined" && !engine) spawn();
}

export type RunResult = { ok: boolean; out: string; error?: string; timedOut?: boolean };

export async function runPython(code: string, timeoutMs = 8000): Promise<RunResult> {
  if (typeof code !== "string") {
    return { ok: false, out: "", error: "Kode tidak valid." };
  }
  const blocked = unsafeCodeReason(code);
  if (blocked) return { ok: false, out: "", error: blocked };

  const e = engine ?? spawn();
  // waktu muat Pyodide tidak dihitung ke timeout kode
  if (!(await e.ready)) {
    kill();
    return { ok: false, out: "", error: "Mesin Python gagal dimuat. Cek koneksi internet lalu coba lagi." };
  }
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      kill();
      resolve({ ok: false, out: "", timedOut: true, error: "Kode berjalan terlalu lama dan dihentikan. Cek apakah ada loop yang tidak berhenti." });
    }, timeoutMs);
    const onMsg = (ev: MessageEvent) => {
      if (ev.data.id !== id) return;
      clearTimeout(timer);
      e.w.removeEventListener("message", onMsg);
      resolve(ev.data);
    };
    e.w.addEventListener("message", onMsg);
    e.w.postMessage({ id, code });
  });
}

export function checkCode(
  step: { out?: string; has?: string[]; need?: string[] },
  source: string,
  res: RunResult,
): { pass: boolean; reason?: string } {
  if (!res.ok) {
    return { pass: false, reason: "Kode belum bisa dijalankan. Baca pesan error di panel output, perbaiki, lalu coba lagi." };
  }
  const patterns = Array.isArray(step.need) ? step.need.slice(0, LIMITS.patterns) : [];
  for (const pattern of patterns) {
    const re = compilePattern(pattern);
    if (!re) {
      return { pass: false, reason: "Pola pemeriksaan materi tidak valid. Hubungi admin." };
    }
    if (!re.test(source)) {
      return { pass: false, reason: `Kode belum memenuhi pola yang diminta: \`${pattern}\`.` };
    }
  }
  const got = res.out.trim();
  if (step.out !== undefined && got !== step.out.trim()) {
    return {
      pass: false,
      reason: `Output belum sama persis. Diharapkan ${JSON.stringify(step.out.trim())}, didapat ${JSON.stringify(got)}.`,
    };
  }
  for (const s of step.has ?? []) {
    if (!got.includes(s)) return { pass: false, reason: `Output belum memuat teks ${JSON.stringify(s)}.` };
  }
  return { pass: true };
}

/**
 * Jalankan setiap `solution` langkah code di Pyodide dan bandingkan hasilnya
 * dengan `out`/`has`/`need`. Mengembalikan daftar masalah yang bisa dikirim
 * kembali ke endpoint generate untuk perbaikan.
 */
export async function validateCodeSolutions(
  lesson: Lesson,
  onStep?: (index: number, total: number) => void,
): Promise<string[]> {
  const steps = lesson.steps.filter((s): s is CodeStep => s.type === "code");
  if (steps.length === 0) return [];

  warmUp();
  const issues: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    onStep?.(i, steps.length);
    const step = steps[i];
    if (!step.solution) {
      issues.push(`Latihan ${i + 1}: solusi tidak tersedia.`);
      continue;
    }

    const res = await runPython(step.solution);
    if (!res.ok) {
      const detail = res.timedOut
        ? "timeout"
        : (res.error ?? "").split("\n").slice(0, 2).join(" ").slice(0, 240);
      issues.push(`Latihan ${i + 1}: solusi gagal dijalankan${detail ? ` — ${detail}` : "."}`);
      continue;
    }

    try {
      const check = checkCode(step, step.solution, res);
      if (!check.pass) issues.push(`Latihan ${i + 1}: ${check.reason ?? "output tidak cocok."}`);
    } catch {
      issues.push(`Latihan ${i + 1}: solusi tidak bisa divalidasi.`);
    }
  }
  return issues;
}
