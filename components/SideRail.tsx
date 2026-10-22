"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, Sparkles, Target } from "lucide-react";
import { Bar, Ring } from "./ui";
import { useGame } from "@/lib/store";
import { dayKey, nextRank, rankOf } from "@/lib/game";
import { fetchSupabaseLessons } from "@/lib/lessons";
import type { Lesson } from "@/lib/types";

const GOAL = 50;

export default function SideRail() {
  const { g } = useGame();
  const today = g.history[dayKey()] ?? 0;
  const rank = rankOf(g.xp);
  const nxt = nextRank(g.xp);
  const [bonus, setBonus] = useState<Lesson[] | null>(null);

  useEffect(() => {
    fetchSupabaseLessons().then(setBonus);
  }, []);
  const bonusDone = bonus?.filter((l) => g.progress[l.id]?.done).length ?? 0;

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { on: (g.history[dayKey(d)] ?? 0) > 0, l: d.toLocaleDateString("id-ID", { weekday: "narrow" }) };
  });

  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-4 overflow-y-auto p-5 pt-20 xl:flex">
      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-display font-bold"><Target size={18} className="text-lime" aria-hidden />Target harian</h2>
        <div className="mt-4 flex items-center gap-4">
          <Ring value={today / GOAL} size={84} stroke={9}>
            <span className="font-display text-lg font-bold leading-none">{Math.min(today, GOAL)}<span className="text-xs text-dim">/{GOAL}</span></span>
          </Ring>
          <p className="text-sm text-dim">{today >= GOAL ? "Target tercapai. Mantap!" : `${GOAL - today} XP lagi untuk target hari ini.`}</p>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 font-display font-bold"><Flame size={18} className="text-lime" aria-hidden />Streak {g.streak} hari</h2>
        <div className="mt-4 flex justify-between">
          {week.map((w, i) => (
            <div key={i} className="grid justify-items-center gap-1.5">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold ${w.on ? "bg-lime text-lime-ink" : "bg-raised text-faint"}`}>{w.on ? "✓" : ""}</span>
              <span className="text-[11px] uppercase text-dim">{w.l}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold">Liga <span style={{ color: rank.color }}>{rank.name}</span></h2>
          <Link href="/ranks" className="text-xs font-semibold text-dim hover:text-ink">Lihat</Link>
        </div>
        {nxt && (<><Bar value={((g.xp - rank.min) / (nxt.min - rank.min)) * 100} className="mt-3" /><p className="mt-2 text-xs text-dim">{nxt.min - g.xp} XP ke {nxt.name}</p></>)}
      </section>

      {/* Materi bonus dari Supabase — user tidak perlu token Groq sendiri */}
      <Link href="/quest#ch-bonus" className="card group flex items-start gap-3 p-4 transition-colors hover:border-lime/40">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-raised text-lime transition-transform group-hover:scale-105"><Sparkles size={18} aria-hidden /></span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="flex items-center justify-between gap-2">
            <b className="font-display">Materi Bonus</b>
            {bonus && bonus.length > 0 && (
              <span className="shrink-0 font-display text-xs font-bold text-lime">{bonusDone}/{bonus.length}</span>
            )}
          </span>
          <span className="block text-dim">
            {bonus === null ? "Memuat…" : bonus.length === 0 ? "Belum ada materi bonus" : `${bonus.length} topik lanjutan, gratis`}
          </span>
          {bonus && bonus.length > 0 && (
            <Bar value={(bonusDone / bonus.length) * 100} className="mt-2 h-1.5" />
          )}
        </span>
      </Link>
    </aside>
  );
}

export function SideRailDummy() {
  return null;
}
