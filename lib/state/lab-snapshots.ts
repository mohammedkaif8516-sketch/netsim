"use client";
/**
 * lab-snapshots.ts — per-ticket lab snapshots.
 *
 * Leaving a ticket unmounts its lab, and the engine deletes a device's state when it unmounts. So while a lab is
 * mounted we keep a snapshot of every device (and the links) up to date, and restore it the next time that ticket's
 * lab mounts. Snapshots live in memory and are mirrored to localStorage, so progress survives a page reload too.
 *
 *   sig      device ids + kinds. If a scenario changes between deployments, the old snapshot is discarded
 *   touched  has the player typed anything? (drives the "In progress" chip in the queue)
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Dev, Link, Store } from "@/lib/engine/netsim";
import { exportMeta, getSession, importMeta, type SessionMeta } from "./lab-session";

const VERSION = 1;
const PREFIX = "netops-lab-v1:";

export interface LabSnapshot {
  v: number;
  sig: string;
  savedAt: number;
  touched: boolean;
  devs: Record<string, Dev>;
  links: Link[];
  meta: SessionMeta;
}

const mem = new Map<string, LabSnapshot>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let version = 0;
const bump = () => { version++; listeners.forEach((f) => f()); };
export const subscribeSnapshots = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useSnapshotVersion = () => useSyncExternalStore(subscribeSnapshots, () => version, () => 0);

export const peekSnapshot = (id: string) => mem.get(id);

const sigOf = (devs: Record<string, Dev>) => Object.values(devs).map((d) => `${d.id}:${d.kind}`).sort().join("|");

/** safe to store as JSON: plain data only (no Map/Set/Date/functions, no NaN) */
function jsonSafe(v: unknown, depth = 0): boolean {
  if (v === null || v === undefined) return true;
  const t = typeof v;
  if (t === "string" || t === "boolean") return true;
  if (t === "number") return Number.isFinite(v as number);
  if (t !== "object" || depth > 40) return false;
  if (Array.isArray(v)) return v.every((x) => jsonSafe(x, depth + 1));
  const p = Object.getPrototypeOf(v);
  if (p !== Object.prototype && p !== null) return false;
  return Object.values(v as object).every((x) => jsonSafe(x, depth + 1));
}
const valid = (x: any): x is LabSnapshot =>
  !!x && x.v === VERSION && typeof x.sig === "string" && x.devs && typeof x.devs === "object" && Array.isArray(x.links) && x.meta && typeof x.meta === "object";

/* ───────── storage ───────── */
const hasStorage = () => typeof window !== "undefined" && !!window.localStorage;

function persist(id: string) {
  timers.delete(id);
  const snap = mem.get(id);
  if (!snap || !hasStorage() || !jsonSafe(snap.devs)) return;
  try { window.localStorage.setItem(PREFIX + id, JSON.stringify(snap)); } catch { /* quota or private mode: memory copy still works */ }
}
const schedulePersist = (id: string) => {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.set(id, setTimeout(() => persist(id), 600));
};
export function flushPersist(id: string) {
  const t = timers.get(id);
  if (t) { clearTimeout(t); persist(id); }
}

function readStored(id: string): LabSnapshot | undefined {
  if (!hasStorage()) return undefined;
  try {
    const raw = window.localStorage.getItem(PREFIX + id);
    if (!raw) return undefined;
    const x = JSON.parse(raw);
    return valid(x) ? x : undefined;
  } catch { return undefined; }
}
export function loadSnapshot(id: string): LabSnapshot | undefined {
  const m = mem.get(id);
  if (m) return m;
  const s = readStored(id);
  if (s) mem.set(id, s);
  return s;
}

/** read every saved lab into memory (so the queue can show progress after a reload) */
export function hydrateSnapshots() {
  if (!hasStorage()) return;
  let n = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    const id = k.slice(PREFIX.length);
    if (mem.has(id)) continue;
    const s = readStored(id);
    if (s) { mem.set(id, s); importMeta(id, s.meta); n++; }
  }
  if (n) bump();
}

export function clearSnapshot(id: string) {
  const t = timers.get(id);
  if (t) { clearTimeout(t); timers.delete(id); }
  mem.delete(id);
  if (hasStorage()) try { window.localStorage.removeItem(PREFIX + id); } catch { /* ignore */ }
  bump();
}
export function clearAllSnapshots() {
  for (const id of [...mem.keys()]) clearSnapshot(id);
  if (hasStorage()) for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(PREFIX)) window.localStorage.removeItem(k);
  }
}
/** test helper: forget everything held in memory, as a page reload would */
export function dropMemorySnapshots() { for (const t of timers.values()) clearTimeout(t); timers.clear(); mem.clear(); bump(); }

/* ───────── capture / restore ───────── */
export function saveSnapshot(id: string, store: Store) {
  const s = store.get();
  const snap: LabSnapshot = {
    v: VERSION, sig: sigOf(s.devs), savedAt: Date.now(),
    touched: Object.values(s.devs).some((d) => d.session.hist.length > 0),
    devs: structuredClone(s.devs), links: structuredClone(s.links), meta: exportMeta(id),
  };
  mem.set(id, snap);
  schedulePersist(id);
  bump();
}

/** put a saved lab back into a freshly mounted one. Returns what was restored, or null. */
export function restoreInto(id: string, store: Store): { commands: number; savedAt: number } | null {
  const snap = loadSnapshot(id);
  if (!snap) return null;
  const now = store.get().devs;
  if (!Object.keys(now).length) return null;
  if (snap.sig !== sigOf(now)) { clearSnapshot(id); return null; } // the scenario changed: stale snapshot
  for (const dev of Object.values(snap.devs)) if (now[dev.id]) store.put(structuredClone(dev));
  importMeta(id, snap.meta);
  const commands = Object.values(snap.devs).reduce((a, d) => a + d.session.hist.length, 0);
  return snap.touched ? { commands, savedAt: snap.savedAt } : null;
}

/**
 * Keeps the ticket's snapshot current while its lab is mounted, and restores it on mount.
 * Call it from a component ABOVE the lab: React runs child effects first, so by then the devices are registered.
 */
export function useLabSnapshots(ticketId: string, store: Store) {
  const [restored, setRestored] = useState<{ commands: number; savedAt: number } | null>(null);
  useEffect(() => {
    getSession(ticketId);
    setRestored(restoreInto(ticketId, store));
    const expected = Object.keys(store.get().devs).length;
    // while the lab unmounts its devices unregister one by one: a partial state must never overwrite the snapshot
    const save = () => { if (expected > 0 && Object.keys(store.get().devs).length >= expected) saveSnapshot(ticketId, store); };
    const unsub = store.subscribe(save);
    return () => { unsub(); flushPersist(ticketId); };
  }, [ticketId, store]);
  return [restored, () => setRestored(null)] as const;
}