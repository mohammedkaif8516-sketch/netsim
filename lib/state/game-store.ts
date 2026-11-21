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
import { tickets } from "@/lib/data/tickets";

export const START_XP = 0;
export const SLA_BONUS_XP = 25;

/**
 * Rank ladder. Rank is earned by RESOLVING TICKETS (there are 18), so it can't be bought with XP alone.
 * `tickets` = how many resolved tickets unlock the level.
 */
export const LEVELS = [
  { level: 1, tickets: 0, rank: "L1 Support" },
  { level: 2, tickets: 3, rank: "L1 Senior Support" },
  { level: 3, tickets: 6, rank: "L2 Network Engineer" },
  { level: 4, tickets: 10, rank: "L2 Senior Engineer" },
  { level: 5, tickets: 14, rank: "L3 Specialist" },
  { level: 6, tickets: 18, rank: "Network Architect" },
] as const;

export function levelInfo(solved: number) {
  let i = 0;
  LEVELS.forEach((l, k) => { if (solved >= l.tickets) i = k; });
  const cur = LEVELS[i], next: (typeof LEVELS)[number] | undefined = LEVELS[i + 1];
  return {
    level: cur.level, rank: cur.rank, solved, base: cur.tickets,
    next: next?.tickets, nextRank: next?.rank,
    pct: next ? Math.round((100 * (solved - cur.tickets)) / (next.tickets - cur.tickets)) : 100,
  };
}

const freshDeadlines = (now: number) => Object.fromEntries(tickets.map((t) => [t.id, now + t.slaSec * 1000]));

export interface Note { id: number; text: string; at: number; read: boolean }
export type Filter = "all" | "mine" | "resolved";
export type Sort = "sla" | "priority" | "age";

interface Game {
  /* session */
  selectedId: string;
  view: "map" | "lab";
  query: string;
  filter: Filter;
  sort: Sort;
  notes: Note[];
  kbOpen: boolean;
  kbTab: "commands" | "guide";
  mapMode: "map" | "topology";
  /* clock */
  now: number | null;          // null until mounted (avoids SSR/client mismatch)
  startedAt: number | null;    // when this session's tickets were opened (drives the health chart)
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
  openKb: (tab?: "commands" | "guide") => void;
  closeKb: () => void;
  setKbTab: (tab: "commands" | "guide") => void;
  setMapMode: (m: "map" | "topology") => void;
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
      kbOpen: false,
      kbTab: "commands",
      mapMode: "map",
      now: null,
      startedAt: null,
      paused: false,
      pausedAt: null,
      deadlines: {},
      xp: START_XP,
      resolved: {},

      init: () => {
        if (Object.keys(get().deadlines).length) return;
        const now = Date.now();
        set({ now, startedAt: now, deadlines: freshDeadlines(now) });
      },
      tick: () => { if (!get().paused) set({ now: Date.now() }); },
      select: (id) => set({ selectedId: id, view: "map" }),
      setView: (view) => set({ view }),
      setQuery: (query) => set({ query }),
      setFilter: (filter) => set({ filter }),
      setSort: (sort) => set({ sort }),
      openKb: (tab) => set((s) => ({ kbOpen: true, kbTab: tab ?? s.kbTab })),
      closeKb: () => set({ kbOpen: false }),
      setKbTab: (kbTab) => set({ kbTab }),
      setMapMode: (mapMode) => set({ mapMode }),

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
        const solved = Object.keys(s.resolved).length;
        const before = levelInfo(solved), after = levelInfo(solved + 1);
        const notes: Note[] = [
          { id: now, text: `${id} resolved${late ? " (SLA breached)" : ""} · +${gain} XP`, at: now, read: false },
        ];
        if (after.level > before.level)
          notes.unshift({ id: now + 1, text: `Rank up! ${after.rank} · level ${after.level}`, at: now, read: false });
        set({
          xp: s.xp + gain,
          resolved: { ...s.resolved, [id]: { at: now, late } },
          notes: [...notes, ...s.notes].slice(0, 20),
        });
      },

      readNotes: () => set((s) => ({ notes: s.notes.map((n) => ({ ...n, read: true })) })),
      resetProgress: () => {
        const now = Date.now();
        set({ xp: START_XP, resolved: {}, notes: [], paused: false, pausedAt: null, now, startedAt: now, deadlines: freshDeadlines(now) });
      },
    }),
    {
      name: "netops-world-v2", // v2: ticket-based ranks, progress starts from zero
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

/** tickets resolved on today's date (local time); rank uses the all-time total instead */
export function resolvedToday(s: Pick<Game, "resolved">) {
  const today = new Date().toDateString();
  return Object.values(s.resolved).filter((r) => new Date(r.at).toDateString() === today).length;
}
export const resolvedTotal = (s: Pick<Game, "resolved">) => Object.keys(s.resolved).length;