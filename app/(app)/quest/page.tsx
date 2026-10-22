"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { Bar } from "@/components/ui";
import { UnitHeader, LessonTrack, TrackSkeleton } from "@/components/QuestTrack";
import { useGame } from "@/lib/store";
import { BUNDLED, CHAPTERS, fetchSupabaseLessons } from "@/lib/lessons";
import { levelOf } from "@/lib/game";
import type { Lesson } from "@/lib/types";

const fmt = (n: number) => n.toLocaleString("id-ID");
const PAGE = 6;
const BONUS_KEY = "bonus";

export default function QuestPage() {
  const { g } = useGame();
  const [bonusLessons, setBonusLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchSupabaseLessons().then((data) => {
      setBonusLessons(data);
      setLoading(false);
    });
  }, []);

  const chapters = CHAPTERS.map((title, index) => {
    const key = `ch-${index}`;
    const lessons = BUNDLED.filter((l) => l.chapter === title);
    const done = lessons.filter((l) => g.progress[l.id]?.done).length;
    return { title, index, key, lessons, done };
  });

  const active = BUNDLED.find((l) => !g.progress[l.id]?.done);
  const activeChapter = active ? chapters.findIndex((u) => u.lessons.some((l) => l.id === active.id)) : -1;
  const totalDone = BUNDLED.filter((l) => g.progress[l.id]?.done).length;
  const lv = levelOf(g.xp);

  // Kalau semua bab utama selesai, sorot materi bonus pertama yang belum dikerjakan.
  const bonusActive = active ? undefined : bonusLessons.find((l) => !g.progress[l.id]?.done)?.id;
  const bonusDone = bonusLessons.filter((l) => g.progress[l.id]?.done).length;
  const bonusXp = bonusLessons.reduce((s, l) => s + l.xp, 0);
  const bonusMinutes = bonusLessons.reduce((s, l) => s + l.minutes, 0);
  const allDone = !active && !loading && bonusLessons.length > 0 && bonusDone === bonusLessons.length;

  const chapterOpen = (index: number) => openUnits[`ch-${index}`] ?? index === activeChapter;
  const bonusOpen = openUnits[BONUS_KEY] ?? !active;

  const allKeys = [...chapters.map((u) => u.key), BONUS_KEY];
  const setAll = (value: boolean) => setOpenUnits(Object.fromEntries(allKeys.map((key) => [key, value])));
  // Untuk lompat antar-bab: buka satu unit saja supaya halaman tetap ringkas.
  const focusUnit = (key: string) => setOpenUnits(Object.fromEntries(allKeys.map((k) => [k, k === key])));

  // Link #ch-bonus dari sidebar / hash langsung tetap membuka unit yang dituju.
  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      const key = hash === "ch-bonus" ? BONUS_KEY : /^ch-\d+$/.test(hash) ? hash : null;
      if (!key) return;
      const keys = [...CHAPTERS.map((_, i) => `ch-${i}`), BONUS_KEY];
      setOpenUnits(Object.fromEntries(keys.map((k) => [k, k === key])));
      setJumpTarget(hash);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  useEffect(() => {
    if (!jumpTarget) return;
    document.getElementById(jumpTarget)?.scrollIntoView({ block: "start" });
    setJumpTarget(null);
  }, [jumpTarget]);

  // Saat progres sudah jauh, geser navigator agar bab aktif tetap terlihat.
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Pilih bab"]');
    const current = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!nav || !current) return;
    nav.scrollLeft = current.offsetLeft - nav.clientWidth / 2 + current.clientWidth / 2;
  }, [activeChapter, loading]);

  const limitFor = (key: string) => visible[key] ?? PAGE;
  const showMore = (key: string, total: number) =>
    setVisible((s) => ({ ...s, [key]: Math.min(total, (s[key] ?? PAGE) + PAGE) }));

  const normalized = query.trim().toLowerCase();
  const filteredBonus = normalized
    ? bonusLessons.filter((l) => `${l.title} ${l.track ?? ""}`.toLowerCase().includes(normalized))
    : bonusLessons;
  // Pastikan misi aktif tidak tersembunyi oleh batas tampilan.
  const bonusActiveIndex = bonusActive ? filteredBonus.findIndex((l) => l.id === bonusActive) : -1;
  const bonusLimit = Math.max(limitFor(BONUS_KEY), bonusActiveIndex + 1);
  const shownBonus = filteredBonus.slice(0, bonusLimit);
  const bonusRemaining = filteredBonus.length - shownBonus.length;
  const bonusTrackCount = new Set(bonusLessons.map((l) => l.track ?? "Fondasi Bonus")).size;
  const trackTotals = new Map<string, number>();
  for (const lesson of filteredBonus) {
    const track = lesson.track ?? "Fondasi Bonus";
    trackTotals.set(track, (trackTotals.get(track) ?? 0) + 1);
  }

  // Kelompokkan materi yang sedang tampil berdasarkan jalur belajar. Nomor
  // misi tetap berlanjut antar-jalur supaya urutannya terasa satu perjalanan.
  const bonusGroups: { track: string; lessons: Lesson[]; start: number }[] = [];
  shownBonus.forEach((lesson, index) => {
    const track = lesson.track ?? "Fondasi Bonus";
    const last = bonusGroups[bonusGroups.length - 1];
    if (last?.track === track) last.lessons.push(lesson);
    else bonusGroups.push({ track, lessons: [lesson], start: index + 1 });
  });

  const jumpTo = (key: string, target: string) => {
    focusUnit(key);
    setJumpTarget(target);
  };

  return (
    <div className="grid gap-8 overflow-x-hidden">
      <section className="card relative overflow-hidden bg-gradient-to-br from-surface via-surface to-[#2a3310] p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-lime/20 blur-3xl" aria-hidden />
        <p className="text-dim">Halo, <b className="text-ink">{g.name}</b></p>
        <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-4xl">
          {allDone ? "Semua quest selesai!" : active ? "Lanjutkan petualanganmu" : "Semua bab utama selesai!"}
        </h1>
        <div className="mt-5 grid gap-1.5">
          <div className="flex justify-between text-sm text-dim"><span>Level {lv.level}</span><span>{lv.into}/{lv.size} XP</span></div>
          <Bar value={(lv.into / lv.size) * 100} />
        </div>
        {allDone ? (
          <Link href="/playground" className="btn btn-lime mt-5 w-full py-4 text-lg sm:w-auto sm:px-8">Latihan bebas di playground</Link>
        ) : active ? (
          <Link href={`/play/${active.id}`} className="btn btn-lime mt-5 w-full py-4 text-lg sm:w-auto sm:px-8">Lanjut: {active.title}</Link>
        ) : (
          <button type="button" onClick={() => jumpTo(BONUS_KEY, "ch-bonus")} className="btn btn-lime mt-5 w-full py-4 text-lg sm:w-auto sm:px-8">
            Lanjut ke Materi Bonus
          </button>
        )}
      </section>

      {/* Navigator + kontrol lipat untuk jumlah bab/materi yang banyak. */}
      <section className="card w-full min-w-0 p-4" aria-label="Peta bab">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dim">Peta belajar</p>
            <h2 className="mt-0.5 font-display text-lg font-bold">{totalDone}/{BUNDLED.length} quest selesai · {CHAPTERS.length} bab</h2>
          </div>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setAll(true)}
              className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-dim transition-colors hover:border-lime/30 hover:text-ink">
              Buka semua
            </button>
            <button type="button" onClick={() => setAll(false)}
              className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-dim transition-colors hover:border-lime/30 hover:text-ink">
              Ringkas
            </button>
          </div>
        </div>

        <nav aria-label="Pilih bab" className="scroll-thin mt-3 flex w-full snap-x gap-2 overflow-x-auto pb-1">
          {chapters.map((u) => {
            const current = u.key === chapters[activeChapter]?.key;
            const pct = u.lessons.length ? (u.done / u.lessons.length) * 100 : 0;
            return (
              <button key={u.key} type="button" onClick={() => jumpTo(u.key, u.key)} aria-current={current ? "step" : undefined} title={u.title}
                className={`snap-start shrink-0 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                  current ? "border-lime/50 bg-lime/10" : "border-line bg-surface hover:border-lime/30"
                }`}>
                <span className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 place-items-center rounded-lg text-[11px] font-bold ${current ? "bg-lime text-lime-ink" : "bg-raised text-lime"}`}>
                    {u.index + 1}
                  </span>
                  <span className="max-w-[9rem] truncate text-xs font-bold">{u.title}</span>
                </span>
                <span className="mt-1.5 flex items-center gap-2 text-[10px] text-dim">
                  <span>{u.done}/{u.lessons.length}</span>
                  <span className="h-1 w-14 overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
                  </span>
                </span>
              </button>
            );
          })}

          <button type="button" onClick={() => jumpTo(BONUS_KEY, "ch-bonus")} aria-current={!active ? "step" : undefined}
            className={`snap-start shrink-0 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
              !active ? "border-grape/50 bg-grape/10" : "border-line bg-surface hover:border-grape/30"
            }`}>
            <span className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-grape/10 text-grape"><Sparkles size={13} aria-hidden /></span>
              <span className="text-xs font-bold">Bonus</span>
            </span>
            <span className="mt-1.5 flex items-center gap-2 text-[10px] text-dim">
              <span>{loading ? "…" : `${bonusDone}/${bonusLessons.length}`}</span>
              <span className="h-1 w-14 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-grape" style={{ width: `${bonusLessons.length ? (bonusDone / bonusLessons.length) * 100 : 0}%` }} />
              </span>
            </span>
          </button>
        </nav>
      </section>

      {/* Tiap bab adalah unit yang bisa dilipat; hanya unit aktif terbuka secara default. */}
      {chapters.map((u) => {
        const open = chapterOpen(u.index);
        const activeIndex = active ? u.lessons.findIndex((l) => l.id === active.id) : -1;
        const shown = u.lessons.slice(0, Math.max(limitFor(u.key), activeIndex + 1));
        const remaining = u.lessons.length - shown.length;
        return (
          <section key={u.key} id={u.key} aria-labelledby={`${u.key}-title`} className="scroll-mt-24">
            <UnitHeader
              id={`${u.key}-title`}
              eyebrow={`Bab ${u.index + 1}`}
              title={u.title}
              lessons={u.lessons}
              open={open}
              onToggle={() => setOpenUnits((s) => ({ ...s, [u.key]: !open }))}
              contentId={`${u.key}-content`}
            />
            <div id={`${u.key}-content`} hidden={!open}>
              <LessonTrack lessons={shown} activeId={active?.id} />
              {remaining > 0 && <ShowMore remaining={remaining} onClick={() => showMore(u.key, u.lessons.length)} />}
            </div>
          </section>
        );
      })}

      {/* Bab bonus dari Supabase — unit terakhir, dengan pencarian + batas tampilan. */}
      <section id="ch-bonus" aria-labelledby="ch-bonus-title" className="scroll-mt-24">
        <UnitHeader
          id="ch-bonus-title"
          eyebrow="Bab Bonus"
          title="Materi Bonus"
          lessons={bonusLessons}
          loading={loading}
          bonus
          description={
            loading
              ? "Memuat materi bonus…"
              : bonusLessons.length === 0
                ? "Belum ada materi bonus."
                : `${bonusLessons.length} materi · ${bonusTrackCount} jalur · ${fmt(bonusXp)} XP · ±${fmt(bonusMinutes)} menit`
          }
          open={bonusOpen}
          onToggle={() => setOpenUnits((s) => ({ ...s, [BONUS_KEY]: !bonusOpen }))}
          contentId="ch-bonus-content"
        />
        <div id="ch-bonus-content" hidden={!bonusOpen}>
          {loading ? (
            <TrackSkeleton rows={4} />
          ) : bonusLessons.length === 0 ? (
            <div className="card mt-4 flex items-center gap-3 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-raised text-grape" aria-hidden>
                <Sparkles size={20} />
              </span>
              <div>
                <p className="font-display font-bold">Belum ada materi bonus</p>
                <p className="mt-0.5 text-sm text-dim">Materi tambahan akan muncul di sini setelah admin menjalankan sync katalog.</p>
              </div>
            </div>
          ) : (
            <>
              {bonusLessons.length > PAGE && (
                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 focus-within:border-lime/40">
                  <Search size={16} className="shrink-0 text-dim" aria-hidden />
                  <input
                    type="text"
                    inputMode="search"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setVisible((s) => ({ ...s, [BONUS_KEY]: PAGE }));
                    }}
                    placeholder="Cari materi bonus…"
                    aria-label="Cari materi bonus"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-faint"
                  />
                  {query && (
                    <button type="button" onClick={() => {
                      setQuery("");
                      setVisible((s) => ({ ...s, [BONUS_KEY]: PAGE }));
                    }} aria-label="Hapus pencarian"
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-dim hover:bg-raised hover:text-ink">
                      <X size={15} aria-hidden />
                    </button>
                  )}
                </div>
              )}

              {filteredBonus.length === 0 ? (
                <div className="card mt-3 flex items-center gap-3 p-4 text-sm text-dim">
                  <Search size={18} className="shrink-0" aria-hidden />
                  Tidak ada materi yang cocok dengan “{query.trim()}”.
                </div>
              ) : (
                <>
                  {bonusGroups.map((group) => {
                    const total = trackTotals.get(group.track) ?? group.lessons.length;
                    return (
                      <section key={group.track} className="mt-4" aria-label={`Jalur ${group.track}`}>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-sm font-bold text-ink">{group.track}</h3>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">
                            {group.lessons.length < total ? `${group.lessons.length}/${total}` : total} materi
                          </span>
                        </div>
                        <LessonTrack
                          lessons={group.lessons}
                          activeId={bonusActive}
                          labelPrefix="Bonus"
                          startNumber={group.start}
                        />
                      </section>
                    );
                  })}
                  {(filteredBonus.length > PAGE || normalized) && (
                    <p className="mt-2 text-xs text-dim" aria-live="polite">
                      Menampilkan {shownBonus.length} dari {filteredBonus.length} materi{normalized ? " yang cocok" : ""}.
                    </p>
                  )}
                  {bonusRemaining > 0 && <ShowMore remaining={bonusRemaining} onClick={() => showMore(BONUS_KEY, filteredBonus.length)} noun="materi" />}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ShowMore({ remaining, onClick, noun = "misi" }: { remaining: number; onClick: () => void; noun?: string }) {
  return (
    <button type="button" onClick={onClick}
      className="mt-3 w-full rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-dim transition-colors hover:border-lime/30 hover:text-ink">
      Tampilkan {Math.min(PAGE, remaining)} {noun} lagi · {remaining} tersisa
    </button>
  );
}
