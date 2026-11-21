"use client";
/**
 * lab-session.ts — what the player has done on a ticket, for the debrief.
 *
 * A session belongs to the TICKET, not to a lab instance: it survives switching tickets (the lab is rebuilt from a
 * snapshot, see lab-snapshots.ts) and page reloads (its meta is saved inside the snapshot).
 *   events   every console command, timestamped (read from each device's `session.hist`)
 *   activeMs time actually spent on this ticket (selected, not paused). Away time doesn't count.
 */
import { useEffect } from "react";
import type { Store } from "@/lib/engine/netsim";

export interface LabEvent { dev: string; line: string; t: number }
export interface SessionMeta { activeMs: number; events: LabEvent[]; resets: number }
export interface LabSession extends SessionMeta {
  ticketId: string;
  store: Store | null;
  /** timestamp of the last active-time tick, null while the ticket isn't being worked on */
  lastTick: number | null;
  /** how many history lines per device have already been turned into events */
  seen: Record<string, number>;
}

const sessions = new Map<string, LabSession>();
export const peekSession = (id: string) => sessions.get(id);

export function getSession(ticketId: string): LabSession {
  let s = sessions.get(ticketId);
  if (!s) { s = { ticketId, store: null, activeMs: 0, events: [], resets: 0, lastTick: null, seen: {} }; sessions.set(ticketId, s); }
  return s;
}
/** total time actively spent on the ticket so far */
export const sessionMs = (s: LabSession) => s.activeMs + (s.lastTick ? Math.max(0, Date.now() - s.lastTick) : 0);

export const exportMeta = (id: string): SessionMeta => {
  const s = getSession(id);
  return { activeMs: sessionMs(s), events: s.events.slice(0, 200), resets: s.resets };
};
/** fill an empty session from saved meta (after a reload) */
export function importMeta(id: string, m: SessionMeta | undefined) {
  const s = getSession(id);
  if (!m || s.events.length || s.activeMs) return;
  s.activeMs = m.activeMs ?? 0; s.events = m.events ?? []; s.resets = m.resets ?? 0;
}
export const dropSession = (id: string) => void sessions.delete(id);
export const dropAllSessions = () => sessions.clear();

/** history lines that already exist when we attach (restored or initial) are not new commands */
function baseline(s: LabSession) {
  s.seen = {};
  if (s.store) for (const d of Object.values(s.store.get().devs)) s.seen[d.id] = d.session.hist.length;
}

export function syncSession(s: LabSession) {
  if (!s.store) return;
  for (const d of Object.values(s.store.get().devs)) {
    const h = d.session.hist, known = s.seen[d.id] ?? 0;
    if (h.length < known) { s.resets++; s.seen[d.id] = h.length; continue; } // the lab was reset
    for (let i = known; i < h.length; i++) s.events.push({ dev: d.id, line: h[i], t: Date.now() });
    s.seen[d.id] = h.length;
  }
}

/** records commands and active time for the selected ticket's lab */
export function useLabRecorder(ticketId: string, store: Store, isPaused: () => boolean) {
  useEffect(() => {
    const s = getSession(ticketId);
    s.store = store;
    baseline(s);
    const unsub = store.subscribe(() => syncSession(s));
    s.lastTick = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      if (!isPaused() && s.lastTick !== null) s.activeMs += now - s.lastTick;
      s.lastTick = now;
    }, 1000);
    return () => {
      clearInterval(iv);
      unsub();
      if (s.lastTick !== null && !isPaused()) s.activeMs += Date.now() - s.lastTick;
      s.lastTick = null;
      if (s.store === store) s.store = null;
    };
    // isPaused reads the live game store, it never changes identity in a way that matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, store]);
}