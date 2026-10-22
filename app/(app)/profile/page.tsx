"use client";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Bar, Icon } from "@/components/ui";
import { actions, useGame } from "@/lib/store";
import { BADGES, dayKey, levelOf, nextRank, rankOf } from "@/lib/game";
import { BUNDLED } from "@/lib/lessons";

export default function Profile() {
  const { g } = useGame();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const rank = rankOf(g.xp);
  const nxt = nextRank(g.xp);
  const lv = levelOf(g.xp);
  const done = Object.values(g.progress).filter((p) => p.done).length;

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { k: dayKey(d), label: d.toLocaleDateString("id-ID", { weekday: "short" }) };
  });
  const max = Math.max(50, ...week.map((w) => g.history[w.k] ?? 0));

  const exportData = () => {
    const url = URL.createObjectURL(new Blob([actions.exportJson()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `pyfun-${dayKey()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importData = async (f?: File) => {
    if (!f) return;
    try { actions.importJson(await f.text()); setMsg("Data berhasil dipulihkan."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "File gagal dibaca."); }
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <span className="grid h-20 w-20 place-items-center rounded-3xl bg-lime font-display text-4xl font-bold text-lime-ink">{(g.name ?? "?")[0].toUpperCase()}</span>
        <div className="min-w-0">
          <input aria-label="Nama" defaultValue={g.name ?? ""} maxLength={20} onBlur={(e) => actions.rename(e.target.value)}
            className="w-full rounded-lg bg-transparent font-display text-3xl font-bold outline-none focus:bg-surface" />
          <p className="text-dim">Level {lv.level} · <span style={{ color: rank.color }}>{rank.name}</span></p>
        </div>
      </div>

      <div className="card bg-gradient-to-br from-surface to-[#2a3310] p-5">
        <div className="flex justify-between text-sm text-dim"><span>Level {lv.level}</span><span>{lv.into}/{lv.size} XP</span></div>
        <Bar value={(lv.into / lv.size) * 100} className="mt-2" />
        {nxt && <p className="mt-3 text-sm text-dim">{nxt.min - g.xp} XP lagi menuju liga {nxt.name}.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["XP", g.xp], ["Streak", g.streak], ["Streak terbaik", g.bestStreak], ["Quest selesai", `${done}/${BUNDLED.length}`]].map(([l, v]) => (
          <div key={l} className="card p-4"><p className="text-sm text-dim">{l}</p><p className="font-display text-2xl font-bold">{v}</p></div>
        ))}
      </div>

      <section className="card p-5" aria-label="XP 7 hari terakhir">
        <h2 className="font-bold">7 hari terakhir</h2>
        <div className="mt-4 flex h-28 items-end gap-2">
          {week.map((w) => {
            const v = g.history[w.k] ?? 0;
            return (
              <div key={w.k} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end"><div className="w-full rounded-md bg-lime" style={{ height: `${(v / max) * 100}%`, minHeight: v ? 4 : 2, opacity: v ? 1 : 0.15 }} title={`${v} XP`} /></div>
                <span className="text-xs text-dim">{w.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-bold">Lencana</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(BADGES).map(([k, b]) => {
            const got = g.badges.includes(k);
            return (
              <div key={k} className={`card flex items-center gap-3 p-3 ${got ? "" : "opacity-40"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${got ? "bg-lime text-lime-ink" : "bg-raised"}`}><Icon name={b.icon} size={18} aria-hidden /></span>
                <div className="min-w-0"><p className="truncate text-sm font-bold">{b.name}</p><p className="text-xs text-dim">{b.desc}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card grid gap-4 p-5">
        <h2 className="font-bold">Data & pengaturan</h2>
        <p className="text-sm text-dim">Semua data ada di browser ini. Ekspor sebagai cadangan, atau pindahkan ke perangkat lain.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportData} className="btn btn-dark"><Download size={16} aria-hidden /> Ekspor</button>
          <button onClick={() => file.current?.click()} className="btn btn-dark"><Upload size={16} aria-hidden /> Impor</button>
          <input ref={file} type="file" accept="application/json" hidden onChange={(e) => importData(e.target.files?.[0])} />
        </div>
        {msg && <p className="text-sm text-lime" role="status">{msg}</p>}
        <button onClick={() => confirm("Reset semua progres?") && (actions.reset(), setMsg("Progres direset."))}
          className="justify-self-start text-sm font-semibold text-danger hover:underline">Reset progres</button>
      </section>
    </div>
  );
}
