/**
 * health.ts — every number on the Network health panel comes from here, derived from the tickets.
 * Open tickets drag the network down by priority; resolving them brings it back.
 * Pure functions, no React: easy to test and to tune (see the constants).
 */
import { tickets, type Priority, type Ticket } from "@/lib/data/tickets";
import { world } from "@/lib/data/world";

type Resolved = Record<string, { at: number }>;

/** availability with no open incidents */
export const BEST = 99.99;
/** availability lost per open ticket, by priority */
const AVAIL_LOSS: Record<Priority, number> = { P1: 0.06, P2: 0.012, P3: 0.004 };
/** latency (ms) with a healthy network, and added per open ticket */
const LAT_BASE = 12;
const LAT_ADD: Record<Priority, number> = { P1: 1.5, P2: 0.6, P3: 0.2 };

const round2 = (n: number) => Math.round(n * 100) / 100;

const sitesTotal = world.reduce((a, c) => a + c.cities.reduce((b, x) => b + x.sites, 0), 0);
/** each site is modelled like the detailed building: devices per site = devices in that city's departments */
const devicesTotal = world.reduce((a, c) => a + c.cities.reduce((b, city) => b + city.sites * city.buildings.reduce((d, bl) => d + bl.departments.reduce((e, dp) => e + dp.devices, 0), 0), 0), 0);
const deptDevices = new Map(world.flatMap((c) => c.cities.flatMap((ci) => ci.buildings.flatMap((b) => b.departments.map((d) => [d.id, d.devices] as const)))));

const loss = (open: Ticket[]) => open.reduce((a, t) => a + AVAIL_LOSS[t.priority], 0);

export interface Health {
  availability: number;
  /** availability if nothing had been resolved yet, for the +/- delta */
  baseline: number;
  open: { P1: number; P2: number; P3: number; total: number };
  sitesTotal: number;
  /** an open P1 takes its site down */
  sitesConnected: number;
  /** an open P2 leaves a site degraded */
  sitesDegraded: number;
  devicesTotal: number;
  /** devices in departments that currently have an open ticket */
  devicesAlerting: number;
  latencyMs: number;
}

export function snapshot(resolved: Resolved): Health {
  const open = tickets.filter((t) => !resolved[t.id]);
  const n = (p: Priority) => open.filter((t) => t.priority === p).length;
  const P1 = n("P1"), P2 = n("P2"), P3 = n("P3");
  const alerting = new Set(open.map((t) => t.deptId));
  return {
    availability: round2(BEST - loss(open)),
    baseline: round2(BEST - loss(tickets)),
    open: { P1, P2, P3, total: open.length },
    sitesTotal,
    sitesConnected: Math.max(0, sitesTotal - P1),
    sitesDegraded: Math.min(P2, Math.max(0, sitesTotal - P1)),
    devicesTotal,
    devicesAlerting: [...alerting].reduce((a, d) => a + (deptDevices.get(d) ?? 0), 0),
    latencyMs: Math.round(LAT_BASE + P1 * LAT_ADD.P1 + P2 * LAT_ADD.P2 + P3 * LAT_ADD.P3),
  };
}

/**
 * Availability over the last `hours`, replayed from ticket history: a ticket drags the line down from
 * the moment it opened (`ageMin` before the session started) until the moment it was resolved.
 */
export function series(resolved: Resolved, startedAt: number, now: number, hours: number, points = hours === 24 ? 25 : 13): number[] {
  const span = hours * 3_600_000;
  return Array.from({ length: points }, (_, i) => {
    const ts = now - span + (span * i) / (points - 1);
    const open = tickets.filter((t) => {
      const opened = startedAt - t.ageMin * 60_000;
      const r = resolved[t.id];
      return ts >= opened && !(r && r.at <= ts);
    });
    return BEST - loss(open);
  });
}

/* ───────── chart geometry (viewBox 0 0 700 90) ───────── */
const W = 700, TOP = 9, H = 66, FLOOR = 99.6;
export const yFor = (v: number) => Math.min(84, Math.max(TOP, TOP + ((100 - v) / (100 - FLOOR)) * H));

/** smooth line through the points (midpoint quadratic curves) */
export function linePath(values: number[]): string {
  if (!values.length) return "";
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, yFor(v)] as const);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [nx, ny] = pts[i + 1];
    d += ` Q${x.toFixed(1)} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
}
export const areaPath = (line: string) => (line ? `${line} L${W} 90 L0 90Z` : "");