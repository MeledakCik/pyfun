export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 15 * 60 * 1000;

export const RANKS = [
  { name: "Bronze", min: 0, color: "#d6935a" },
  { name: "Silver", min: 300, color: "#c4c9d4" },
  { name: "Gold", min: 900, color: "#f5c84b" },
  { name: "Platinum", min: 2000, color: "#63f7ff" },
  { name: "Diamond", min: 4000, color: "#e0b6ff" },
] as const;

export function rankOf(xp: number) {
  let r: (typeof RANKS)[number] = RANKS[0];
  for (const x of RANKS) if (xp >= x.min) r = x;
  return r;
}

export function nextRank(xp: number) {
  return RANKS.find((r) => r.min > xp) ?? null;
}

/** Level naik tiap 150 XP. */
export function levelOf(xp: number) {
  const size = 150;
  const level = Math.floor(xp / size) + 1;
  return { level, into: xp % size, size };
}

export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86400000);
}

export const BADGES: Record<string, { name: string; desc: string; icon: string }> = {
  first: { name: "Langkah pertama", desc: "Selesaikan quest pertama", icon: "Footprints" },
  perfect: { name: "Tanpa salah", desc: "Selesaikan quest tanpa kehilangan nyawa", icon: "Sparkles" },
  streak3: { name: "Api kecil", desc: "Streak 3 hari", icon: "Flame" },
  streak7: { name: "Api unggun", desc: "Streak 7 hari", icon: "Flame" },
  boss: { name: "Pembasmi boss", desc: "Kalahkan satu boss", icon: "Skull" },
  xp500: { name: "500 XP", desc: "Kumpulkan 500 XP", icon: "Zap" },
  ai: { name: "Arsitek materi", desc: "Buat materi dengan AI", icon: "Wand2" },
};
