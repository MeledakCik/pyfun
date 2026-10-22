"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { validateCodeSolutions } from "@/lib/python";
import { actions, useGame } from "@/lib/store";
import type { Lesson } from "@/lib/types";

type DraftLevel = "pemula" | "menengah";

type RepairRequest = {
  attempt: number;
  errors: string[];
  lesson: Lesson;
};

function isLesson(value: unknown): value is Lesson {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.title !== "string") return false;
  if (!Array.isArray(v.steps) || v.steps.length === 0) return false;
  return v.steps.every(
    (step) =>
      step !== null &&
      typeof step === "object" &&
      typeof (step as Record<string, unknown>).type === "string",
  );
}

async function requestDraft(topic: string, level: DraftLevel, repair?: RepairRequest): Promise<Lesson> {
  const res = await fetch("/api/lessons/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, level, ...(repair ? { repair } : {}) }),
  });
  const data = (await res.json().catch(() => null)) as { lesson?: unknown; error?: unknown } | null;
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Gagal membuat materi. Coba lagi.");
  }
  if (!isLesson(data?.lesson)) {
    throw new Error("Balasan materi tidak valid. Coba topik lain.");
  }
  return data.lesson;
}

async function requestSuggestions(completedIds: string[]): Promise<string[]> {
  const res = await fetch("/api/lessons/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completedIds }),
  });
  const data = (await res.json().catch(() => null)) as { topics?: unknown; error?: unknown } | null;
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "Gagal mengambil saran topik.");
  }
  const topics = Array.isArray(data?.topics)
    ? data.topics.filter((topic): topic is string => typeof topic === "string")
    : [];
  return [...new Set(topics)].slice(0, 5);
}

export function GenerateLesson({ onSaved }: { onSaved?: (lesson: Lesson) => void }) {
  const { g } = useGame();
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<DraftLevel>("pemula");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Lesson | null>(null);

  const completedIds = Object.entries(g.progress)
    .filter(([, progress]) => progress.done)
    .map(([id]) => id);

  const suggest = async () => {
    setSuggesting(true);
    setError("");
    setStatus("Mencari saran topik…");
    try {
      const topics = await requestSuggestions(completedIds);
      setSuggestions(topics);
      setStatus(topics.length ? "Pilih salah satu saran, atau tulis topik sendiri." : "Belum ada saran. Tulis topik sendiri.");
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "Gagal mengambil saran topik.");
    } finally {
      setSuggesting(false);
    }
  };

  const generate = async () => {
    const clean = topic.trim();
    if (clean.length < 3) {
      setError("Topik minimal 3 karakter.");
      return;
    }

    setBusy(true);
    setError("");
    setSaved(null);
    try {
      setStatus("Membuat draft materi…");
      let draft = await requestDraft(clean, level);

      setStatus("Menguji solusi kode di Pyodide…");
      let issues = await validateCodeSolutions(draft, (index, total) => {
        setStatus(`Menguji solusi ${index + 1}/${total} di Pyodide…`);
      });

      for (let attempt = 1; attempt <= 2 && issues.length > 0; attempt++) {
        setStatus(`Ada ${issues.length} solusi bermasalah. Meminta AI memperbaiki (${attempt}/2)…`);
        draft = await requestDraft(clean, level, { attempt, errors: issues, lesson: draft });
        setStatus("Menguji ulang solusi di Pyodide…");
        issues = await validateCodeSolutions(draft, (index, total) => {
          setStatus(`Menguji ulang solusi ${index + 1}/${total} di Pyodide…`);
        });
      }

      if (issues.length > 0) {
        setStatus("");
        setError(`Materi belum lolos validasi setelah 2 perbaikan dan tidak disimpan.\n${issues.slice(0, 3).join("\n")}`);
        return;
      }

      const entry = actions.saveGenerated({ ...draft, level });
      setSaved(entry);
      setSuggestions([]);
      setTopic("");
      setStatus(`Materi "${entry.title}" disimpan ke Materi Saya.`);
      onSaved?.(entry);
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "Gagal membuat materi. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const locked = busy || suggesting;

  return (
    <section id="buat-materi" className="card scroll-mt-24 overflow-hidden p-5 sm:p-6" aria-labelledby="buat-materi-title">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-grape/30 bg-grape/10 text-grape" aria-hidden>
          <Wand2 size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dim">AI · Materi Saya</p>
          <h2 id="buat-materi-title" className="mt-0.5 font-display text-xl font-bold">Buat materi sendiri</h2>
          <p className="mt-1 text-sm text-dim">
            Tulis topik Python. Setiap solusi kode diuji di Pyodide sebelum materi disimpan.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <label className="grid gap-1.5 text-xs font-semibold text-dim">
          Topik
          <input
            type="text"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setError("");
              setSaved(null);
            }}
            maxLength={80}
            placeholder="Contoh: list comprehension"
            disabled={busy}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-normal text-ink outline-none placeholder:text-faint focus:border-lime disabled:opacity-60"
          />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-dim">
          Tingkat
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value === "menengah" ? "menengah" : "pemula")}
            disabled={busy}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-normal text-ink outline-none focus:border-lime disabled:opacity-60"
          >
            <option value="pemula">Pemula</option>
            <option value="menengah">Menengah</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={suggest} disabled={locked} className="btn btn-dark px-4 py-2.5 text-sm">
          {suggesting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Sparkles size={16} aria-hidden />}
          {suggesting ? "Mencari saran…" : "Sarankan topik"}
        </button>
        <button type="button" onClick={generate} disabled={locked || topic.trim().length < 3} className="btn btn-lime px-4 py-2.5 text-sm">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Wand2 size={16} aria-hidden />}
          {busy ? "Memproses…" : "Buat materi"}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Saran topik">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={locked}
              onClick={() => {
                setTopic(suggestion);
                setError("");
                setSaved(null);
              }}
              className="rounded-full border border-line bg-raised px-3 py-1.5 text-xs font-semibold text-dim transition-colors hover:border-grape/40 hover:text-ink disabled:opacity-60"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {status && (
        <p className="mt-3 text-sm text-dim" aria-live="polite">{status}</p>
      )}
      {error && (
        <p role="alert" className="mt-3 whitespace-pre-wrap break-words rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm text-ink/80">
          {error}
        </p>
      )}
      {saved && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-lime/30 bg-lime/10 p-3 text-sm">
          <Check size={16} className="shrink-0 text-lime" aria-hidden />
          <span className="min-w-0 flex-1 break-words text-ink/80">Tersimpan di Materi Saya: <b className="text-ink">{saved.title}</b></span>
          <Link href={`/play/${saved.id}`} className="btn btn-dark px-3 py-2 text-xs">Buka materi</Link>
        </div>
      )}
    </section>
  );
}
