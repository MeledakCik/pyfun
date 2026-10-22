"use client";
import { useSyncExternalStore } from "react";
import { BADGES, HEART_REGEN_MS, MAX_HEARTS, dayKey, daysBetween } from "./game";
import type { Lesson } from "./types";

export type Progress = { stars: number; done: boolean };

export type Game = {
  v: 1;
  name: string | null;
  joinedAt: number;
  xp: number;
  streak: number;
  bestStreak: number;
  lastDay: string | null;
  hearts: number;
  heartsAt: number;
  progress: Record<string, Progress>;
  history: Record<string, number>; // YYYY-MM-DD -> xp
  badges: string[];
  code: string; // isi playground
};

const KEY = "pyfun:v1";

export const INITIAL: Game = {
  v: 1,
  name: null,
  joinedAt: 0,
  xp: 0,
  streak: 0,
  bestStreak: 0,
  lastDay: null,
  hearts: MAX_HEARTS,
  heartsAt: 0,
  progress: {},
  history: {},
  badges: [],
  code: 'nama = "PyFun"\nprint("Halo,", nama)\n',
};

let state: Game = INITIAL;
let hydrated = false;
const listeners = new Set<() => void>();

function load() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrasi: buang field lama yang sudah tidak dipakai
      const { custom: _c, apiKey: _a, ...rest } = parsed;
      state = { ...INITIAL, ...rest };
    }
  } catch {}
  regen();
}

function commit(next: Game) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

function regen() {
  if (state.hearts >= MAX_HEARTS) return;
  const gained = Math.floor((Date.now() - state.heartsAt) / HEART_REGEN_MS);
  if (gained > 0) {
    const hearts = Math.min(MAX_HEARTS, state.hearts + gained);
    state = { ...state, hearts, heartsAt: hearts >= MAX_HEARTS ? 0 : state.heartsAt + gained * HEART_REGEN_MS };
  }
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Pembacaan state; `ready` false sampai localStorage terbaca di client. */
export function useGame() {
  const g = useSyncExternalStore(subscribe, () => (load(), state), () => INITIAL);
  const ready = useSyncExternalStore(subscribe, () => hydrated, () => false);
  return { g, ready };
}

export const actions = {
  start(name: string) {
    commit({ ...state, name: name.trim() || "Cadet", joinedAt: state.joinedAt || Date.now() });
  },
  rename(name: string) {
    commit({ ...state, name: name.trim() || state.name });
  },
  tickHearts() {
    const before = state;
    regen();
    if (state !== before) commit(state);
  },
  loseHeart() {
    regen();
    if (state.hearts <= 0) return;
    commit({
      ...state,
      hearts: state.hearts - 1,
      heartsAt: state.hearts >= MAX_HEARTS ? Date.now() : state.heartsAt,
    });
  },
  refillHearts() {
    commit({ ...state, hearts: MAX_HEARTS, heartsAt: 0 });
  },
  saveCode(code: string) {
    commit({ ...state, code });
  },
  /** Dipanggil saat quest selesai. Mengembalikan ringkasan untuk layar hasil. */
  complete(lesson: Lesson, mistakes: number) {
    const today = dayKey();
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    const prev = state.progress[lesson.id];
    const first = !prev?.done;
    const gained = first ? lesson.xp : Math.max(10, Math.round(lesson.xp / 10));

    let streak = state.streak;
    if (state.lastDay !== today) {
      streak = state.lastDay && daysBetween(state.lastDay, today) === 1 ? state.streak + 1 : 1;
    }

    const xp = state.xp + gained;
    const badges = new Set(state.badges);
    badges.add("first");
    if (mistakes === 0) badges.add("perfect");
    if (streak >= 3) badges.add("streak3");
    if (streak >= 7) badges.add("streak7");
    if (lesson.boss) badges.add("boss");
    if (xp >= 500) badges.add("xp500");

    const newBadges = [...badges].filter((b) => !state.badges.includes(b) && BADGES[b as keyof typeof BADGES]);

    commit({
      ...state,
      xp,
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      lastDay: today,
      progress: {
        ...state.progress,
        [lesson.id]: { done: true, stars: Math.max(prev?.stars ?? 0, stars) },
      },
      history: { ...state.history, [today]: (state.history[today] ?? 0) + gained },
      badges: [...badges],
    });
    return { gained, stars, streak, newBadges, first };
  },
  exportJson() {
    return JSON.stringify(state, null, 2);
  },
  importJson(raw: string) {
    const parsed = JSON.parse(raw);
    if (parsed?.v !== 1) throw new Error("Format file tidak dikenali");
    commit({ ...INITIAL, ...parsed });
  },
  reset() {
    commit({ ...INITIAL, name: state.name, joinedAt: state.joinedAt, code: state.code });
  },
};
