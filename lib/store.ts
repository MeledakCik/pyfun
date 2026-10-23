"use client";
import { useSyncExternalStore } from "react";
import { BADGES, dayKey, daysBetween } from "./game";
import { cleanCode, cleanName, sanitizeGeneratedLesson, validLessonId } from "./sanitize";
import type { Lesson } from "./types";

export type Progress = { stars: number; done: boolean };

export type Game = {
  v: 2;
  name: string | null;
  joinedAt: number;
  xp: number;
  streak: number;
  bestStreak: number;
  lastDay: string | null;
  progress: Record<string, Progress>;
  history: Record<string, number>; // YYYY-MM-DD -> xp
  badges: string[];
  code: string; // isi playground
  /** Materi AI yang disimpan lokal; tidak pernah dikirim ke Supabase. */
  generated: Lesson[];
};

// Key lama dipertahankan agar data pengguna tetap terbaca; versi schema ada di `v`.
const KEY = "pyfun:v1";

export const INITIAL: Game = {
  v: 2,
  name: null,
  joinedAt: 0,
  xp: 0,
  streak: 0,
  bestStreak: 0,
  lastDay: null,
  progress: {},
  history: {},
  badges: [],
  code: 'nama = "PyFun"\nprint("Halo,", nama)\n',
  generated: [],
};

const GENERATED_LIMIT = 50;
const MAX_CODE = 20_000;
const MAX_IMPORT = 1_000_000;

let state: Game = INITIAL;
let hydrated = false;
const listeners = new Set<() => void>();

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const finite = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * Migrasi state lama (`v: 1`) ke schema saat ini.
 * Field nyawa (`hearts`, `heartsAt`) dan field sensitif lama (`custom`, `apiKey`)
 * dibuang; XP, streak, lencana, progres, dan kode playground tetap dipertahankan.
 */
function migrate(raw: unknown): Game {
  const old = isRecord(raw) ? raw : {};
  const progress: Game["progress"] = {};
  if (isRecord(old.progress)) {
    for (const [id, value] of Object.entries(old.progress)) {
      if (!validLessonId(id) || !isRecord(value) || typeof value.done !== "boolean") continue;
      progress[id] = { done: value.done, stars: Math.max(0, Math.min(3, finite(value.stars, 0))) };
    }
  }

  const history: Game["history"] = {};
  if (isRecord(old.history)) {
    for (const [day, xp] of Object.entries(old.history)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      if (typeof xp === "number" && Number.isFinite(xp) && xp >= 0) history[day] = Math.min(xp, 1_000_000);
    }
  }

  const generated: Lesson[] = [];
  const seenGenerated = new Set<string>();
  if (Array.isArray(old.generated)) {
    for (const value of old.generated) {
      const entry = sanitizeGeneratedLesson(value);
      if (!entry || seenGenerated.has(entry.id)) continue;
      seenGenerated.add(entry.id);
      generated.push(entry);
      if (generated.length >= GENERATED_LIMIT) break;
    }
  }

  const name = cleanName(old.name);

  return {
    v: 2,
    name: name || null,
    joinedAt: Math.max(0, finite(old.joinedAt, 0)),
    xp: Math.max(0, finite(old.xp, 0)),
    streak: Math.max(0, finite(old.streak, 0)),
    bestStreak: Math.max(0, finite(old.bestStreak, 0)),
    lastDay: typeof old.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(old.lastDay) ? old.lastDay : null,
    progress,
    history,
    badges: Array.isArray(old.badges)
      ? [...new Set(old.badges.filter((b): b is string => typeof b === "string" && b.length <= 40))]
      : [],
    code: cleanCode(old.code, MAX_CODE) || INITIAL.code,
    generated,
  };
}

function load() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && raw.length <= MAX_IMPORT) {
      state = migrate(JSON.parse(raw));
      // Simpan hasil migrasi agar field lama (mis. nyawa) tidak terbaca lagi.
      localStorage.setItem(KEY, JSON.stringify(state));
    }
  } catch {}
}

function commit(next: Game) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
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
    commit({ ...state, name: cleanName(name) || "Pelajar", joinedAt: state.joinedAt || Date.now() });
  },
  rename(name: string) {
    commit({ ...state, name: cleanName(name) || state.name });
  },
  saveCode(code: string) {
    commit({ ...state, code: cleanCode(code, MAX_CODE) });
  },
  /** Simpan draft AI yang sudah lolos validasi ke koleksi lokal "Materi Saya". */
  saveGenerated(lesson: Lesson) {
    const now = Date.now();
    const entry = sanitizeGeneratedLesson({
      ...lesson,
      id: `gen-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      chapter: "Materi Saya",
      title: lesson.title || "Materi baru",
      source: "generated",
      track: "Materi Saya",
      boss: false,
      createdAt: now,
    });
    if (!entry) throw new Error("Materi tidak valid dan tidak disimpan.");
    commit({
      ...state,
      generated: [entry, ...state.generated].slice(0, GENERATED_LIMIT),
    });
    return entry;
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
    if (typeof raw !== "string" || raw.length > MAX_IMPORT) {
      throw new Error("File terlalu besar atau tidak valid");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("File bukan JSON yang valid");
    }
    if (!isRecord(parsed) || (parsed.v !== 1 && parsed.v !== 2)) {
      throw new Error("Format file tidak dikenali");
    }
    commit(migrate(parsed));
  },
  reset() {
    commit({ ...INITIAL, name: state.name, joinedAt: state.joinedAt, code: state.code });
  },
};
