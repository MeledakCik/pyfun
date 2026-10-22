"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame, Heart, Lightbulb, X, Zap } from "lucide-react";
import { Bar, Confetti, Icon } from "@/components/ui";
import { CodeBlock, Rich } from "@/components/Rich";
import { Editor, Output, RunButton } from "@/components/Editor";
import { actions, useGame } from "@/lib/store";
import { findLesson, fetchSupabaseLessons, isUnlocked } from "@/lib/lessons";
import { BADGES, HEART_REGEN_MS } from "@/lib/game";
import { checkCode, runPython, warmUp, type RunResult } from "@/lib/python";
import type { CodeStep, Lesson, QuizStep } from "@/lib/types";

type Phase = "answer" | "right" | "wrong" | "done";
type Summary = ReturnType<typeof actions.complete>;

export default function Play({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { g, ready } = useGame();
  const [bonusLessons, setBonusLessons] = useState<Lesson[]>([]);
  const lesson = ready ? findLesson(id, bonusLessons) : undefined;

  useEffect(() => {
    fetchSupabaseLessons().then(setBonusLessons);
  }, []);

  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [stepFails, setStepFails] = useState(0);
  const [phase, setPhase] = useState<Phase>("answer");
  const [pick, setPick] = useState<number | null>(null);
  const [src, setSrc] = useState("");
  const [res, setRes] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [hint, setHint] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const finished = useRef(false);

  const step = lesson?.steps[idx];

  // siapkan editor saat masuk langkah kode
  useEffect(() => {
    if (step?.type === "code") {
      setSrc(step.starter);
      warmUp();
    }
    setPick(null); setRes(null); setNote(""); setHint(false); setStepFails(0); setPhase("answer");
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

  const outOfHearts = g.hearts <= 0 && phase !== "done";
  if (outOfHearts) {
    const mins = Math.max(1, Math.ceil((g.heartsAt + HEART_REGEN_MS - Date.now()) / 60000));
    return (
      <Center>
        <Heart size={56} className="text-danger" aria-hidden />
        <h1 className="mt-4 text-3xl font-bold">Nyawa habis</h1>
        <p className="mt-2 max-w-sm text-dim">Satu nyawa pulih tiap 15 menit (sekitar {mins} menit lagi). Sambil menunggu, latihan bebas di playground tidak memakai nyawa.</p>
        <div className="mt-6 grid w-full max-w-xs gap-3">
          <Link href="/playground" className="btn btn-lime">Buka playground</Link>
          <Link href="/quest" className="btn btn-dark">Kembali ke peta</Link>
        </div>
      </Center>
    );
  }

  const total = lesson.steps.length;
  const next = () => {
    if (idx + 1 < total) { setIdx(idx + 1); return; }
    if (!finished.current) {
      finished.current = true;
      setSummary(actions.complete(lesson, mistakes));
    }
    setPhase("done");
  };

  const wrong = (msg: string) => {
    actions.loseHeart();
    setMistakes((m) => m + 1);
    setStepFails((f) => f + 1);
    setNote(msg);
    setPhase("wrong");
  };

  const checkQuiz = (s: QuizStep) => {
    if (pick === null) return;
    if (pick === s.answer) { setNote(s.explain); setPhase("right"); }
    else wrong("Coba pilih jawaban lain.");
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
    else if (!r.ok) { setNote(v.reason!); setPhase("wrong"); } // error sintaks/runtime tidak memakai nyawa
    else wrong(v.reason!);
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
  const canCheck = step?.type === "quiz" ? pick !== null : step?.type === "code" ? src.trim().length > 0 : true;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-5">
      <header className="flex items-center gap-4 py-4">
        <Link href="/quest" aria-label="Keluar dari quest" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-dim hover:text-ink"><X size={20} /></Link>
        <Bar value={(idx / total) * 100} />
        <span className="flex shrink-0 items-center gap-1.5 font-display font-bold"><Heart size={18} className="text-danger" fill="currentColor" aria-hidden />{g.hearts}</span>
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
            <Editor value={src} onChange={setSrc} onRun={runOnly} onReset={() => { setSrc(step.starter); setRes(null); }} />
            <div className="flex items-center gap-3">
              <RunButton onClick={runOnly} busy={busy} />
              {step.hint && (
                <button onClick={() => setHint(true)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-dim hover:text-ink">
                  <Lightbulb size={16} aria-hidden /> Petunjuk
                </button>
              )}
              {step.solution && stepFails >= 2 && (
                <button onClick={() => setSrc(step.solution!)} className="rounded-xl px-3 py-2 text-sm font-semibold text-dim hover:text-ink">Lihat jawaban</button>
              )}
            </div>
            {hint && step.hint && <p className="rounded-2xl bg-raised p-4 text-sm"><b className="text-lime">Petunjuk:</b> {step.hint}</p>}
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
          {phase === "right" && <button className="btn btn-lime shrink-0 px-8" onClick={next}>Lanjut</button>}
          {phase === "wrong" && (
            <button className="btn btn-danger shrink-0 px-8" onClick={() => setPhase("answer")}>Coba lagi</button>
          )}
        </div>
      </footer>
    </div>
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
