"use client";

/**
 * game-store.ts — all game state in one place (zustand).
 *
 *   selection / view / queue filters ... session only
 *   xp, resolved tickets ................ persisted to localStorage (rehydrated on mount)
 *   deadlines, now, pause ............... SLA timers: absolute timestamps, frozen while paused
 *
 * Nothing here renders anything. Components read slices with `useGame(selector)`.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { tickets } from "../data/tickets";

export const BASE_RESOLVED_TODAY = 12;
export const START_XP = 640;
export const SLA_BONUS_XP = 25;

export const LEVELS = [
  { level: 1, min: 0, rank: "L1 Support" },
  { level: 2, min: 300, rank: "L1 Support" },
  { level: 3, min: 900, rank: "L2 Engineer" },
  { level: 4, min: 1800, rank: "L2 Engineer" },
  { level: 5, min: 3000, rank: "L3 Specialist" },
] as const;

export function levelInfo(xp: number) {
  let i = 0;
  LEVELS.forEach((l, k) => { if (xp >= l.min) i = k; });
  const cur = LEVELS[i], next = LEVELS[i + 1];
  return {
    level: cur.level, rank: cur.rank, base: cur.min, next: next?.min,
    pct: next ? Math.round((100 * (xp - cur.min)) / (next.min - cur.min)) : 100,
  };
}

export interface Note { id: number; text: string; at: number; read: boolean }
export type Filter = "all" | "mine";
export type Sort = "sla" | "priority" | "age";

interface Game {
  /* session */
  selectedId: string;
  view: "map" | "lab";
  query: string;
  filter: Filter;
  sort: Sort;
  notes: Note[];
  /* clock */
  now: number | null;          // null until mounted (avoids SSR/client mismatch)
  paused: boolean;
  pausedAt: number | null;
  deadlines: Record<string, number>;
  /* persisted */
  xp: number;
  resolved: Record<string, { at: number; late: boolean }>;

  init: () => void;
  tick: () => void;
  select: (id: string) => void;
  setView: (v: "map" | "lab") => void;
  setQuery: (q: string) => void;
  setFilter: (f: Filter) => void;
  setSort: (s: Sort) => void;
  togglePause: () => void;
  resolve: (id: string, baseXp: number) => void;
  readNotes: () => void;
  resetProgress: () => void;
}

export const useGame = create<Game>()(
  persist(
    (set, get) => ({
      selectedId: tickets[0].id,
      view: "map",
      query: "",
      filter: "all",
      sort: "sla",
      notes: [],
      now: null,
      paused: false,
      pausedAt: null,
      deadlines: {},
      xp: START_XP,
      resolved: {},

      init: () => {
        if (Object.keys(get().deadlines).length) return;
        const now = Date.now();
        set({ now, deadlines: Object.fromEntries(tickets.map((t) => [t.id, now + t.slaSec * 1000])) });
      },
      tick: () => { if (!get().paused) set({ now: Date.now() }); },
      select: (id) => set({ selectedId: id, view: "map" }),
      setView: (view) => set({ view }),
      setQuery: (query) => set({ query }),
      setFilter: (filter) => set({ filter }),
      setSort: (sort) => set({ sort }),

      togglePause: () => {
        const s = get(), t = Date.now();
        if (!s.paused) return set({ paused: true, pausedAt: s.now ?? t });
        // resume: push every deadline forward by the time spent paused
        const gap = t - (s.pausedAt ?? t);
        set({
          paused: false, pausedAt: null, now: t,
          deadlines: Object.fromEntries(Object.entries(s.deadlines).map(([k, v]) => [k, v + gap])),
        });
      },

      resolve: (id, baseXp) => {
        const s = get();
        if (s.resolved[id]) return;
        const now = s.now ?? Date.now(), late = s.deadlines[id] !== undefined && now > s.deadlines[id];
        const gain = baseXp + (late ? 0 : SLA_BONUS_XP);
        const before = levelInfo(s.xp), after = levelInfo(s.xp + gain);
        const notes: Note[] = [
          { id: now, text: `${id} resolved${late ? " (SLA breached)" : ""} · +${gain} XP`, at: now, read: false },
        ];
        if (after.level > before.level)
          notes.unshift({ id: now + 1, text: `Level up! You are now level ${after.level} · ${after.rank}`, at: now, read: false });
        set({
          xp: s.xp + gain,
          resolved: { ...s.resolved, [id]: { at: now, late } },
          notes: [...notes, ...s.notes].slice(0, 20),
        });
      },

      readNotes: () => set((s) => ({ notes: s.notes.map((n) => ({ ...n, read: true })) })),
      resetProgress: () => set({ xp: START_XP, resolved: {}, notes: [], deadlines: {}, paused: false, pausedAt: null }),
    }),
    {
      name: "netops-world-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ xp: s.xp, resolved: s.resolved }),
      skipHydration: true, // we call useGame.persist.rehydrate() in an effect so SSR output matches
    },
  ),
);

/* ───────── derived values ───────── */
export const secondsLeft = (deadline: number | undefined, now: number | null, fallback: number) =>
  deadline === undefined || now === null ? fallback : Math.round((deadline - now) / 1000);

/** share of tickets not past their SLA (open and overdue, or resolved late, both count against it) */
export function slaHealth(s: Pick<Game, "now" | "deadlines" | "resolved">) {
  let breached = 0;
  for (const t of tickets) {
    const r = s.resolved[t.id];
    if (r) { if (r.late) breached++; }
    else if (s.now !== null && s.deadlines[t.id] !== undefined && s.now > s.deadlines[t.id]) breached++;
  }
  return Math.round((100 * (tickets.length - breached)) / tickets.length);
}
