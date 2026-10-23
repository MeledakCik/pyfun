"use client";
import { useEffect, useState } from "react";
import { Crown, Loader2, RefreshCw, Trophy } from "lucide-react";
import { useGame } from "@/lib/store";
import { nextRank, rankOf } from "@/lib/game";
import { fetchRankBoard, syncRank, type RankBoard, type RankEntry } from "@/lib/rank";

function Podium({ entries }: { entries: RankEntry[] }) {
  if (entries.length === 0) return null;

  const top = entries.slice(0, 3);
  const order = [top[1], top[0], top[2]].filter((entry): entry is RankEntry => Boolean(entry));
  const heights: Record<number, string> = { 1: "h-32", 2: "h-24", 3: "h-20" };

  return (
    <div className="card flex items-end justify-center gap-3 overflow-hidden bg-gradient-to-b from-surface via-surface to-[#1f260c] px-4 pt-8 shadow-[0_28px_38px_-30px_rgba(0,0,0,0.9)]" aria-label="Tiga besar">
      {order.map((r) => (
        <div key={r.id} className="flex w-full max-w-[140px] min-w-0 flex-1 flex-col items-center">
          {r.position === 1 && <Crown size={26} className="mb-1 text-lime" aria-label="Juara 1" />}
          <span className={`grid h-14 w-14 place-items-center rounded-2xl font-display text-xl font-bold sm:h-16 sm:w-16 ${r.me ? "bg-lime text-lime-ink glow-lime" : "bg-raised shadow-[0_16px_26px_-20px_rgba(0,0,0,0.95)]"}`}>
            {r.name.charAt(0).toUpperCase() || "?"}
          </span>
          <p className="mt-2 max-w-full truncate font-bold">{r.name}</p>
          <p className="text-sm font-bold text-lime">{r.xp} XP</p>
          <div className={`mt-3 grid w-full place-items-start rounded-t-2xl border border-b-0 border-line bg-raised pt-2 text-center font-display text-2xl font-bold text-dim shadow-[0_-16px_28px_-24px_rgba(200,243,34,0.5)] ${heights[r.position] ?? "h-20"}`}>
            <span className="w-full">{r.position}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Ranks() {
  const { g, ready } = useGame();
  const [board, setBoard] = useState<RankBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ready) return;

    let active = true;
    setLoading(true);
    setError("");

    const request = g.name ? syncRank(g.name, []) : fetchRankBoard();

    request
      .then((data) => {
        if (active) setBoard(data);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Papan peringkat belum bisa dimuat.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ready, g.name, g.xp, reloadKey]);

  const me = board?.entries.find((entry) => entry.me) ?? null;
  const leagueXp = me?.xp ?? g.xp;
  const league = rankOf(leagueXp);
  const next = nextRank(leagueXp);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Rank</h1>
          <p className="mt-1 text-dim">
            {me ? (
              <>
                Kamu di posisi <b className="text-ink">#{me.position}</b> dari {board?.total ?? me.position}. Liga
                peringkat <span style={{ color: league.color }}>{league.name}</span>
                {next ? ` · ${Math.max(0, next.min - leagueXp)} XP lagi ke ${next.name}` : ""}.
              </>
            ) : board ? (
              "Selesaikan materi resmi untuk masuk papan peringkat."
            ) : (
              "Papan peringkat pemain asli dari materi resmi."
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-dark"
          onClick={() => setReloadKey((key) => key + 1)}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <RefreshCw size={16} aria-hidden />}
          Muat ulang
        </button>
      </div>

      {error ? (
        <div className="card border-danger/40 p-5" role="alert">
          <p className="font-bold text-danger">Papan peringkat belum bisa dimuat</p>
          <p className="mt-1 text-sm text-dim">{error}</p>
          <p className="mt-2 text-xs text-faint">
            Pastikan tabel rank sudah dibuat di Supabase (jalankan{" "}
            <code className="font-mono text-ink">supabase/schema.sql</code>) dan{" "}
            <code className="font-mono text-ink">SUPABASE_SERVICE_ROLE_KEY</code> tersedia di server.
          </p>
        </div>
      ) : loading && !board ? (
        <div className="card grid gap-3 p-6" aria-busy="true" aria-live="polite">
          <div className="h-6 w-40 animate-pulse rounded bg-raised" />
          <div className="h-28 animate-pulse rounded-2xl bg-raised" />
          <div className="h-14 animate-pulse rounded-2xl bg-raised" />
        </div>
      ) : board && board.entries.length === 0 ? (
        <div className="card p-8 text-center">
          <Trophy size={34} className="mx-auto text-lime" aria-hidden />
          <p className="mt-3 font-bold">Belum ada peserta</p>
          <p className="mt-1 text-sm text-dim">
            {g.name
              ? "Selesaikan satu materi resmi untuk masuk papan peringkat. Papan ini hanya berisi pemain asli."
              : "Isi nama di halaman awal, lalu selesaikan satu materi resmi untuk masuk papan peringkat."}
          </p>
        </div>
      ) : board ? (
        <>
          <Podium entries={board.entries} />
          {board.entries.length > 3 && (
            <ol className="grid gap-2">
              {board.entries.slice(3).map((entry) => (
                <li
                  key={entry.id}
                  className={`flex items-center gap-4 rounded-2xl border p-4 transition-all hover-lift ${entry.me ? "border-lime/50 bg-[#222a0d]" : "border-line bg-surface"}`}
                >
                  <span className="w-6 text-center font-display text-lg font-bold text-dim">{entry.position}</span>
                  <span className={`grid h-10 w-10 place-items-center rounded-xl font-display font-bold ${entry.me ? "bg-lime text-lime-ink" : "bg-raised"}`}>
                    {entry.name.charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="flex-1 truncate font-bold">
                    {entry.name}
                    {entry.me && <span className="ml-2 text-sm font-normal text-dim">(kamu)</span>}
                  </span>
                  <span className="font-display font-bold text-lime">{entry.xp} XP</span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}

      <p className="text-xs text-faint">
        XP peringkat dihitung server dari materi resmi yang kamu selesaikan. Materi buatan sendiri
        tidak menambah XP peringkat. Mengulang materi yang sudah tercatat juga tidak menambah XP
        lagi; materi lama yang belum tercatat bisa dimasukkan dengan menyelesaikannya sekali lagi.
      </p>
    </div>
  );
}
