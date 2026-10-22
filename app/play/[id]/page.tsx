"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame, Lightbulb, X, Zap } from "lucide-react";
import { Bar, Confetti, Icon } from "@/components/ui";
import { CodeBlock, Rich } from "@/components/Rich";
import { Editor, Output, RunButton } from "@/components/Editor";
import { actions, useGame } from "@/lib/store";
import { submitRankCompletion } from "@/lib/rank";
import { findLesson, fetchSupabaseLessons, isUnlocked } from "@/lib/lessons";
import { BADGES } from "@/lib/game";
import { checkCode, runPython, warmUp, type RunResult } from "@/lib/python";
import type { CodeStep, DebugStep, Lesson, PredictStep, QuizStep } from "@/lib/types";

type Phase = "answer" | "right" | "wrong" | "done";
type Summary = ReturnType<typeof actions.complete>;
type TestResult = { label: string; pass: boolean; expected: string; got: string; error?: string };

export default function Play({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { g, ready } = useGame();
  const [bonusLessons, setBonusLessons] = useState<Lesson[]>([]);
  const lesson = ready ? findLesson(id, bonusLessons, g.generated) : undefined;

  useEffect(() => {
    fetchSupabaseLessons().then(setBonusLessons);
  }, []);

  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [pick, setPick] = useState<number | null>(null);
  const [src, setSrc] = useState("");
  const [guess, setGuess] = useState("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [res, setRes] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const finished = useRef(false);

  const step = lesson?.steps[idx];

  // siapkan editor dan tebakan saat masuk langkah baru
  useEffect(() => {
    setGuess("");
    setTestResults([]);
    if (step?.type === "code" || step?.type === "debug") {
      setSrc(step.starter);
      warmUp();
    }
    if (step?.type === "predict") warmUp();
    setPick(null); setRes(null); setNote(""); setHintLevel(0); setPhase("answer");
  }, [idx, step]);

  useEffect(() => {
    if (ready && !g.name) router.replace("/");
  }, [ready, g.name, router]);

  if (!ready || !g.name) return <div className="min-h-dvh" />;
  if (!lesson || !isUnlocked(lesson, g.progress)) {
    return (
      <Center>
        <h1 className="text-2xl font-bold">Quest tidak ditemukan atau masih terkunci</h1>
        <Link href="/quest" className="btn btn-lime mt-6">Kembali ke peta</Link>
      </Center>
    );
  }

  // Dua tingkat petunjuk untuk latihan kode, predict, dan debug. Kalau materi
  // belum punya hint2, susun petunjuk kedua dari chips atau strategi umum.
  const stepHints =
    step && (step.type === "code" || step.type === "predict" || step.type === "debug")
      ? [
          step.hint ||
            (step.type === "predict"
              ? "Baca kode dari atas ke bawah dan catat nilai setiap variabel."
              : step.type === "debug"
                ? "Jalankan kode, lalu bandingkan output dengan test case yang gagal."
                : "Baca kembali prompt dan tentukan input, proses, serta output yang diminta."),
          step.hint2 ||
            (step.type === "code" && step.chips?.length
              ? `Coba susun dari potongan ini: ${step.chips.join(" · ")}.`
              : step.type === "predict"
                ? "Perhatikan spasi dan baris baru; `print()` menambahkan baris baru di akhir output."
                : step.type === "debug"
                  ? "Periksa batas perulangan dan kondisi; ubah satu bagian lalu jalankan test lagi."
                  : "Pecah masalah menjadi langkah kecil, lalu jalankan untuk memeriksa output tiap langkah."),
        ]
      : [];

  const total = lesson.steps.length;
  const next = () => {
    if (idx + 1 < total) { setHintLevel(0); setIdx(idx + 1); return; }
    if (!finished.current) {
      finished.current = true;
      setSummary(actions.complete(lesson, mistakes));
      if (lesson.source === "bundled" || lesson.source === "supabase" || lesson.source === "catalog") {
        void submitRankCompletion(lesson.id, g.name).catch(() => {});
      }
    }
    setPhase("done");
  };

  const wrong = (msg: string) => {
    setMistakes((m) => m + 1);
    setNote(msg);
    setPhase("wrong");
  };

  const checkQuiz = (s: QuizStep) => {
    if (pick === null) return;
    if (pick === s.answer) {
      setNote(s.explain);
      setPhase("right");
      return;
    }
    const chosen = s.options[pick] ?? "Pilihan itu";
    const correct = s.options[s.answer] ?? "opsi yang benar";
    const reason = s.wrong?.[pick] || s.explain;
    wrong(`Jawabanmu "${chosen}" belum tepat. ${reason} Jawaban yang benar: "${correct}".`);
  };

  const runOnly = async () => {
    setBusy(true); setRes(await runPython(src)); setBusy(false);
  };

  const checkCodeStep = async (s: CodeStep) => {
    setBusy(true);
    const r = await runPython(src);
    setRes(r);
    setBusy(false);
    const v = checkCode(s, src, r);
    if (v.pass) { setNote("Output sesuai. Kerja bagus!"); setPhase("right"); }
    else if (!r.ok) { setNote(v.reason!); setPhase("wrong"); } // error sintaks/runtime tidak mengunci langkah
    else wrong(v.reason!);
  };

  const checkPredict = async (s: PredictStep) => {
    setBusy(true);
    const r = await runPython(s.code);
    setRes(r);
    setBusy(false);
    if (!r.ok) {
      setNote("Kode contoh gagal dijalankan. Coba lagi sebentar lagi.");
      setPhase("wrong");
      return;
    }
    const actual = r.out.trim();
    const explain = s.explain ? ` ${s.explain}` : "";
    if (guess.trim() === actual) {
      setNote(`Tepat! Output sebenarnya ${JSON.stringify(actual)}.${explain}`);
      setPhase("right");
    } else {
      wrong(`Tebakanmu ${JSON.stringify(guess.trim())} belum tepat. Output sebenarnya ${JSON.stringify(actual)}.${explain}`);
    }
  };

  const checkDebugStep = async (s: DebugStep) => {
    if (s.tests.length === 0) {
      setNote("Belum ada test case untuk latihan ini.");
      setPhase("wrong");
      return;
    }
    setBusy(true);
    setRes(null);
    const results: TestResult[] = [];
    for (const [i, test] of s.tests.entries()) {
      const label = test.label ?? `Test ${i + 1}`;
      const r = await runPython(`${src}\n\n${test.code}`);
      const got = r.ok ? r.out.trim() : "";
      results.push({
        label,
        pass: r.ok && got === test.expected.trim(),
        expected: test.expected.trim(),
        got,
        error: r.ok ? undefined : r.error,
      });
      if (r.timedOut) break;
    }
    setTestResults(results);
    setBusy(false);
    const failed = results.find((r) => !r.pass);
    if (!failed) {
      setNote("Semua test lulus. Bug berhasil diperbaiki!");
      setPhase("right");
      return;
    }
    const detail = failed.error
      ? `Test "${failed.label}" masih error. ${failed.error.split("\n")[0]}`
      : `Test "${failed.label}" gagal. Diharapkan ${JSON.stringify(failed.expected)}, didapat ${JSON.stringify(failed.got)}.`;
    wrong(detail);
  };

  /* ------- layar hasil ------- */
  if (phase === "done" && summary) {
    return (
      <Center>
        <Confetti />
        <div className="pop glow-lime grid h-24 w-24 place-items-center rounded-3xl bg-lime text-lime-ink"><Icon name={lesson.icon} size={44} aria-hidden /></div>
        <h1 className="mt-6 text-4xl font-bold">{lesson.boss ? "Boss dikalahkan" : "Quest selesai"}</h1>
        <p className="mt-1 text-dim">{lesson.title}</p>
        <div className="mt-6 flex gap-3">
          <Tile icon={<Zap size={18} className="text-lime" />} label="XP" value={`+${summary.gained}`} />
          <Tile icon={<Flame size={18} className="text-lime" />} label="Streak" value={`${summary.streak} hari`} />
          <Tile icon={<span className="text-lime">★</span>} label="Bintang" value={`${summary.stars}/3`} />
        </div>
        {summary.newBadges.length > 0 && (
          <p className="mt-5 text-sm text-dim">Lencana baru: <b className="text-ink">{summary.newBadges.map((b) => BADGES[b as keyof typeof BADGES]?.name).join(", ")}</b></p>
        )}
        <Link href="/quest" className="btn btn-lime mt-8 w-full max-w-xs py-4 text-lg">Lanjut</Link>
      </Center>
    );
  }

  const isLearn = step?.type === "learn";
  const canCheck =
    step?.type === "quiz"
      ? pick !== null
      : step?.type === "code" || step?.type === "debug"
        ? src.trim().length > 0
        : step?.type === "predict"
          ? guess.trim().length > 0
          : true;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5">
      <header className="flex items-center gap-4 py-4">
        <Link href="/quest" aria-label="Keluar dari quest" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-dim hover:text-ink"><X size={20} /></Link>
        <Bar value={(idx / total) * 100} />
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-raised font-display text-lg font-bold text-lime"
          title="Percobaan tanpa batas"
          aria-label="Percobaan tanpa batas"
        >∞</span>
      </header>

      <main className="flex-1 pb-44 pt-4">
        {step?.type === "learn" && (
          <div className="pop grid gap-4">
            <h1 className="text-3xl font-bold">{step.title}</h1>
            <div className="grid gap-3 text-lg leading-relaxed text-ink/90"><Rich text={step.body} /></div>
            {step.code && <CodeBlock code={step.code} />}
          </div>
        )}

        {step?.type === "quiz" && (
          <div className="grid gap-5">
            <h1 className="text-2xl font-bold leading-snug">{step.q}</h1>
            <div className="grid gap-3" role="radiogroup" aria-label="Pilihan jawaban">
              {step.options.map((o, i) => {
                const on = pick === i;
                const locked = phase !== "answer" && phase !== "wrong";
                return (
                  <button key={i} role="radio" aria-checked={on} disabled={locked}
                    onClick={() => { setPick(i); if (phase === "wrong") setPhase("answer"); }}
                    className={`rounded-2xl border-2 px-5 py-4 text-left font-mono text-base transition-colors ${phase === "right" && i === step.answer ? "border-lime bg-lime/10"
                      : on ? "border-lime bg-raised" : "border-line bg-surface hover:border-faint"} ${phase === "wrong" && on ? "shake !border-danger" : ""}`}>
                    {o}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step?.type === "code" && (
          <div className="grid gap-4">
            <div className="card flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-lime"><Icon name="Terminal" size={20} aria-hidden /></span>
              <div className="grid gap-1 text-lg leading-snug"><Rich text={step.prompt} /></div>
            </div>
            {step.chips && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Potongan kode">
                {step.chips.map((c) => (
                  <button key={c} onClick={() => setSrc((s) => s + (s.endsWith("\n") || s === "" ? "" : " ") + c)}
                    className="rounded-full bg-raised px-4 py-2 font-mono text-sm text-lime hover:bg-line">{c}</button>
                ))}
              </div>
            )}
            <Editor value={src} onChange={setSrc} onRun={runOnly} onReset={() => { setSrc(step.starter); setRes(null); setHintLevel(0); }} />
            <Hints
              leading={<RunButton onClick={runOnly} busy={busy} />}
              hints={stepHints}
              level={hintLevel}
              onNext={() => setHintLevel((n) => Math.min(stepHints.length, n + 1))}
              solution={step.solution}
              onSolution={() => { setSrc(step.solution!); setRes(null); setHintLevel(stepHints.length + 1); }}
            />
            <Output text={res?.out ?? ""} error={res?.error} running={busy} idle={!res} />
          </div>
        )}

        {step?.type === "predict" && (
          <div className="grid gap-4">
            <div className="card flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-lime"><Icon name="Sparkles" size={20} aria-hidden /></span>
              <div className="grid gap-1 text-lg leading-snug"><Rich text={step.prompt} /></div>
            </div>
            <CodeBlock code={step.code} />
            <label className="grid gap-2 text-sm font-semibold text-dim">
              Tebakan output
              <textarea
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                rows={4}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder="Tulis output persis seperti yang akan dicetak..."
                className="scroll-thin w-full resize-y rounded-2xl border border-line bg-surface p-4 font-mono text-sm leading-6 text-ink caret-lime outline-none focus:border-lime"
              />
            </label>
            <Hints
              hints={stepHints}
              level={hintLevel}
              onNext={() => setHintLevel((n) => Math.min(stepHints.length, n + 1))}
            />
            {(busy || res) && <Output text={res?.out ?? ""} error={res?.error} running={busy} />}
          </div>
        )}

        {step?.type === "debug" && (
          <div className="grid gap-4">
            <div className="card flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-lime"><Icon name="Wand2" size={20} aria-hidden /></span>
              <div className="grid gap-1 text-lg leading-snug"><Rich text={step.prompt} /></div>
            </div>
            <div className="card p-4">
              <p className="font-display text-sm font-bold text-dim">Test case</p>
              <ul className="mt-2 grid gap-1 font-mono text-sm text-ink/80">
                {step.tests.map((t, i) => <li key={i}>• {t.label ?? `Test ${i + 1}`}</li>)}
              </ul>
            </div>
            <Editor
              value={src}
              onChange={setSrc}
              onRun={runOnly}
              onReset={() => { setSrc(step.starter); setRes(null); setTestResults([]); setHintLevel(0); }}
            />
            <Hints
              leading={<RunButton onClick={runOnly} busy={busy} />}
              hints={stepHints}
              level={hintLevel}
              onNext={() => setHintLevel((n) => Math.min(stepHints.length, n + 1))}
              solution={step.solution}
              onSolution={() => { setSrc(step.solution!); setRes(null); setTestResults([]); setHintLevel(stepHints.length + 1); }}
            />
            {testResults.length > 0 && (
              <div className="grid gap-2" aria-label="Hasil test case">
                {testResults.map((t, i) => (
                  <div key={`${i}-${t.label}`} className={`rounded-2xl border p-4 text-sm ${t.pass ? "border-lime/40 bg-lime/10" : "border-danger/40 bg-danger/10"}`}>
                    <p className={`font-bold ${t.pass ? "text-lime" : "text-danger"}`}>{t.pass ? "Lulus" : "Gagal"} · {t.label}</p>
                    {!t.pass && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-ink/80">
                        {t.error ?? `Diharapkan ${JSON.stringify(t.expected)}, didapat ${JSON.stringify(t.got)}.`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Output text={res?.out ?? ""} error={res?.error} running={busy} idle={!res} />
          </div>
        )}
      </main>

      {/* bilah aksi bawah */}
      <footer className={`fixed inset-x-0 bottom-0 z-40 border-t px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 ${phase === "right" ? "rise border-lime/30 bg-[#1d2608]" : phase === "wrong" ? "rise border-danger/30 bg-[#2a1210]" : "border-line bg-bg"}`}>
        <div className="mx-auto flex max-w-2xl items-center gap-4">
          {phase !== "answer" && (
            <div className="min-w-0 flex-1">
              <p className={`flex items-center gap-2 font-display text-lg font-bold ${phase === "right" ? "text-lime" : "text-danger"}`}>
                {phase === "right" ? <Check size={20} aria-hidden /> : <X size={20} aria-hidden />}
                {phase === "right" ? "Benar!" : "Belum tepat"}
              </p>
              <div className="text-sm text-ink/80"><Rich text={note} /></div>
            </div>
          )}
          {phase === "answer" && isLearn && <button className="btn btn-lime w-full py-4 text-lg" onClick={next}>Lanjut</button>}
          {phase === "answer" && step?.type === "quiz" && (
            <button className="btn btn-lime w-full py-4 text-lg" disabled={!canCheck} onClick={() => checkQuiz(step)}>Periksa</button>
          )}
          {phase === "answer" && step?.type === "code" && (
            <button className="btn btn-lime w-full py-4 text-lg" disabled={!canCheck || busy} onClick={() => checkCodeStep(step)}>Periksa</button>
          )}
          {phase === "answer" && step?.type === "predict" && (
            <button className="btn btn-lime w-full py-4 text-lg" disabled={!canCheck || busy} onClick={() => checkPredict(step)}>Periksa</button>
          )}
          {phase === "answer" && step?.type === "debug" && (
            <button className="btn btn-lime w-full py-4 text-lg" disabled={!canCheck || busy} onClick={() => checkDebugStep(step)}>Periksa</button>
          )}
          {phase === "right" && <button className="btn btn-lime shrink-0 px-8" onClick={next}>Lanjut</button>}
          {phase === "wrong" && (
            <button className="btn btn-danger shrink-0 px-8" onClick={() => setPhase("answer")}>Coba lagi</button>
          )}
        </div>
      </footer>
    </div>
  );
}

function Hints({
  leading,
  hints,
  level,
  onNext,
  solution,
  onSolution,
}: {
  leading?: React.ReactNode;
  hints: string[];
  level: number;
  onNext: () => void;
  solution?: string;
  onSolution?: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {leading}
        {level < hints.length && (
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-dim hover:text-ink"
          >
            <Lightbulb size={16} aria-hidden /> Petunjuk {level + 1}
          </button>
        )}
        {solution && onSolution && level === hints.length && (
          <button
            onClick={onSolution}
            className="rounded-xl px-3 py-2 text-sm font-semibold text-dim hover:text-ink"
          >
            Lihat solusi
          </button>
        )}
      </div>
      {level > 0 && (
        <div className="grid gap-2">
          {hints.slice(0, level).map((h, i) => (
            <div key={i} className="rounded-2xl bg-raised p-4 text-sm">
              <p className="font-bold text-lime">Petunjuk {i + 1}</p>
              <div className="mt-1 text-ink/80"><Rich text={h} /></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 text-center">{children}</main>;
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card min-w-24 px-4 py-3">
      <div className="flex items-center justify-center gap-1.5 text-xs text-dim">{icon}{label}</div>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
    </div>
  );
}
