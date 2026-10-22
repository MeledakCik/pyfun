"use client";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Clock, Layers, Lock, Sparkles, Star, Zap } from "lucide-react";
import { Bar, Icon } from "@/components/ui";
import { isUnlocked } from "@/lib/lessons";
import { useGame } from "@/lib/store";
import type { Lesson } from "@/lib/types";

const fmt = (n: number) => n.toLocaleString("id-ID");

/** Header unit/bab: nomor, judul, progres, dan ringkasan XP. */
export function UnitHeader({
  id,
  eyebrow,
  title,
  lessons,
  loading = false,
  bonus = false,
  description,
  open = true,
  onToggle,
  contentId,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lessons: Lesson[];
  loading?: boolean;
  bonus?: boolean;
  description?: string;
  open?: boolean;
  onToggle?: () => void;
  contentId?: string;
}) {
  const { g } = useGame();
  const total = lessons.length;
  const done = lessons.filter((l) => g.progress[l.id]?.done).length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const totalXp = lessons.reduce((s, l) => s + l.xp, 0);
  const meta = description ?? `${total} quest · ${fmt(totalXp)} XP`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full blur-3xl ${bonus ? "bg-grape/15" : "bg-lime/10"}`}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
              bonus ? "border-grape/30 bg-grape/10 text-grape" : "border-lime/20 bg-raised text-lime"
            }`}
          >
            {bonus ? <Sparkles size={18} aria-hidden /> : <span className="font-display text-sm font-bold">{eyebrow.replace(/\D/g, "")}</span>}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dim">{eyebrow}</p>
            <h2 id={id} className="truncate font-display text-lg font-bold leading-tight sm:text-xl">{title}</h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-raised px-3 py-1.5 font-display text-xs font-bold text-lime sm:text-sm">
            {loading ? "…" : `${done}/${total}`}
          </span>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-controls={contentId}
              aria-label={open ? `Sembunyikan ${title}` : `Tampilkan ${title}`}
              className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${
                open ? "border-lime/30 bg-lime/10 text-lime hover:bg-lime/15" : "border-line bg-raised text-dim hover:border-lime/30 hover:text-ink"
              }`}
            >
              <ChevronDown size={18} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <p className="relative mt-2.5 text-xs text-dim sm:text-sm">{meta}</p>
      <Bar value={pct} className="relative mt-3 h-2" />
    </div>
  );
}

/** Daftar misi berurutan; pengganti peta berkelok agar alurnya lebih jelas. */
export function LessonTrack({
  lessons,
  activeId,
  labelPrefix = "Misi",
  startNumber = 1,
}: {
  lessons: Lesson[];
  activeId?: string;
  labelPrefix?: string;
  startNumber?: number;
}) {
  const { g } = useGame();
  if (lessons.length === 0) return null;

  return (
    <ol className="relative mt-4">
      <span
        aria-hidden
        className="absolute bottom-6 left-[21px] top-6 w-0.5 bg-gradient-to-b from-line via-line to-transparent"
      />
      {lessons.map((l, i) => {
        const p = g.progress[l.id];
        const stars = p?.stars ?? 0;
        const isDone = !!p?.done;
        const open = isUnlocked(l, g.progress);
        const active = l.id === activeId;
        const last = i === lessons.length - 1;

        const node =
          isDone
            ? "border-lime/50 bg-lime text-lime-ink"
            : active
              ? "border-lime bg-lime text-lime-ink glow-lime"
              : open
                ? "border-lime/30 bg-raised text-lime"
                : "border-line bg-surface text-faint";

        const card =
          isDone
            ? "border-lime/25 bg-lime/[0.04]"
            : active
              ? "border-lime/50 bg-gradient-to-r from-lime/[0.09] to-surface"
              : open
                ? "border-line bg-surface group-hover:border-lime/35 group-hover:bg-raised/60"
                : "border-line/70 bg-surface/50";

        const body = (
          <>
            <span className={`relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 transition-transform ${node} ${open ? "group-hover:scale-105" : ""}`}>
              {!open ? <Lock size={18} aria-hidden /> : isDone ? <Check size={20} strokeWidth={3} aria-hidden /> : <Icon name={l.icon} size={20} aria-hidden />}
            </span>

            <span className={`relative flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all ${card}`}>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                    {labelPrefix} {String(startNumber + i).padStart(2, "0")}
                  </span>
                  {l.boss && (
                    <span className="rounded-full bg-danger/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-danger">Boss</span>
                  )}
                  {isDone && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-lime/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-lime">
                      <Check size={9} strokeWidth={3} aria-hidden /> Selesai
                    </span>
                  )}
                </span>
                <span className={`mt-0.5 block font-display text-[15px] font-bold leading-snug ${open ? "text-ink" : "text-dim"}`}>
                  {l.title}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold text-dim">
                  <span className="inline-flex items-center gap-1"><Zap size={11} className="text-lime" aria-hidden />{l.xp} XP</span>
                  <span className="inline-flex items-center gap-1"><Clock size={11} aria-hidden />{l.minutes} mnt</span>
                  <span className="inline-flex items-center gap-1"><Layers size={11} aria-hidden />{l.steps.length} langkah</span>
                </span>
              </span>

              <span className="shrink-0">
                {active ? (
                  <span className="rounded-full bg-lime px-3 py-1.5 font-display text-xs font-bold text-lime-ink shadow-[0_2px_0_var(--color-lime-deep)]">Mulai</span>
                ) : isDone ? (
                  <span className="flex gap-0.5" aria-label={`${stars} dari 3 bintang`}>
                    {[1, 2, 3].map((s) => (
                      <Star key={s} size={12} className={s <= stars ? "text-lime" : "text-line"} fill="currentColor" aria-hidden />
                    ))}
                  </span>
                ) : open ? (
                  <span className="grid h-8 w-8 place-items-center rounded-full border border-line text-dim transition-colors group-hover:border-lime/40 group-hover:text-lime">
                    <ChevronRight size={15} aria-hidden />
                  </span>
                ) : null}
              </span>
            </span>
          </>
        );

        return (
          <li key={l.id} className={`relative flex gap-2.5 ${last ? "" : "pb-2.5"}`}>
            {open ? (
              <Link
                href={`/play/${l.id}`}
                aria-label={`${l.title}${isDone ? ", selesai" : active ? ", lanjutkan" : ""}`}
                className="group flex min-w-0 flex-1 gap-2.5 focus-visible:rounded-2xl"
              >
                {body}
              </Link>
            ) : (
              <div aria-label={`${l.title}, terkunci`} className="flex min-w-0 flex-1 gap-2.5 opacity-60">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Placeholder saat materi bonus masih dimuat. */
export function TrackSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-4 grid gap-2.5" aria-busy="true" aria-label="Memuat materi">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-2.5">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-raised" />
          <div className="h-[76px] flex-1 animate-pulse rounded-2xl bg-surface" />
        </div>
      ))}
    </div>
  );
}
