"use client";
import { Crown } from "lucide-react";
import { useGame } from "@/lib/store";
import { nextRank, rankOf } from "@/lib/game";

// Rival NPC: XP-nya mengikuti XP kamu supaya selalu ada yang dikejar.
const RIVALS = [
  { name: "Byte", mul: 1.9, add: 140 }, { name: "Lambda", mul: 1.5, add: 90 }, { name: "Pixel", mul: 1.22, add: 60 },
  { name: "Loopy", mul: 1.08, add: 30 }, { name: "Nano", mul: 0.85, add: 40 }, { name: "Echo", mul: 0.6, add: 55 },
  { name: "Tuple", mul: 0.4, add: 35 }, { name: "Null", mul: 0.2, add: 20 },
];

type Row = { name: string; xp: number; me: boolean };

function Podium({ rows }: { rows: Row[] }) {
  const order = [rows[1], rows[0], rows[2]];
  const heights = ["h-24", "h-32", "h-20"];
  const place = [2, 1, 3];
  return (
    <div className="card grid grid-cols-3 items-end gap-3 bg-gradient-to-b from-surface to-[#1f260c] px-4 pt-8">
      {order.map((r, i) => (
        <div key={r.name} className="flex flex-col items-center">
          {place[i] === 1 && <Crown size={26} className="mb-1 text-lime" aria-label="Juara 1" />}
          <span className={`grid h-14 w-14 place-items-center rounded-2xl font-display text-xl font-bold sm:h-16 sm:w-16 ${r.me ? "bg-lime text-lime-ink glow-lime" : "bg-raised"}`}>{r.name[0].toUpperCase()}</span>
          <p className="mt-2 max-w-full truncate font-bold">{r.name}</p>
          <p className="text-sm font-bold text-lime">{r.xp} XP</p>
          <div className={`mt-3 grid w-full place-items-start rounded-t-2xl border border-b-0 border-line bg-raised pt-2 text-center font-display text-2xl font-bold text-dim ${heights[i]}`}>
            <span className="w-full">{place[i]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Ranks() {
  const { g } = useGame();
  const board: Row[] = [...RIVALS.map((r) => ({ name: r.name, xp: Math.round(g.xp * r.mul + r.add), me: false })), { name: g.name ?? "Kamu", xp: g.xp, me: true }]
    .sort((a, b) => b.xp - a.xp);
  const pos = board.findIndex((b) => b.me) + 1;
  const rank = rankOf(g.xp);
  const nxt = nextRank(g.xp);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-bold">Rank</h1>
        <p className="mt-1 text-dim">Kamu di posisi <b className="text-ink">#{pos}</b> dari {board.length}. Liga <span style={{ color: rank.color }}>{rank.name}</span>{nxt ? ` · ${nxt.min - g.xp} XP lagi ke ${nxt.name}` : ""}.</p>
      </div>
      <Podium rows={board} />
      <ol className="grid gap-2">
        {board.slice(3).map((b, i) => (
          <li key={b.name} className={`flex items-center gap-4 rounded-2xl border p-4 ${b.me ? "border-lime/50 bg-[#222a0d]" : "border-line bg-surface"}`}>
            <span className="w-6 text-center font-display text-lg font-bold text-dim">{i + 4}</span>
            <span className={`grid h-10 w-10 place-items-center rounded-xl font-display font-bold ${b.me ? "bg-lime text-lime-ink" : "bg-raised"}`}>{b.name[0].toUpperCase()}</span>
            <span className="flex-1 truncate font-bold">{b.name}{b.me && <span className="ml-2 text-sm font-normal text-dim">(kamu)</span>}</span>
            <span className="font-display font-bold text-lime">{b.xp} XP</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-faint">Rival adalah karakter NPC yang tersimpan lokal, tanpa server. Belum ada papan skor online.</p>
    </div>
  );
}
