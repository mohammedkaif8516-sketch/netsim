"use client";
import { useMemo, useSyncExternalStore } from "react";
import { createStore, type Store } from "@/lib/engine/netsim";
import type { Check } from "@/lib/scenarios/types";

/** a fresh simulator store per ticket (a new ticket = a fresh lab) */
export const useLabStore = (ticketId: string): Store => useMemo(() => createStore(), [ticketId]);

/**
 * Live result of every check. Re-evaluates whenever the simulator state changes,
 * i.e. after each CLI command, so the checklist ticks as the player fixes things.
 */
export function useCheckResults(store: Store, checks: Check[]): boolean[] {
  const s = useSyncExternalStore(store.subscribe, store.get, store.get);
  return useMemo(
    () => checks.map((c) => { try { return c.test(s); } catch { return false; } }),
    [s, checks],
  );
}
