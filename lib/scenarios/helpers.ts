/** Small helpers shared by scenario files: device setup (for `init`) and live checks. */
import { bcastOf, ip2n, n2ip, probe, routeTable, type Dev, type State } from "@/lib/engine/netsim";

export const M24 = "255.255.255.0";
export const M30 = "255.255.255.252";
export const M32 = "255.255.255.255";

/** give an interface an address and bring it up */
export function setIf(d: Dev, name: string, ip: string, mask: string) {
  const i = (d.ifaces[name] ??= { shut: false });
  i.ip = ip; i.mask = mask; i.shut = false;
}
/** static route via a next-hop address (what `ip route <net> <mask> <nh>` stores) */
export const addRoute = (d: Dev, net: string, mask: string, nh: string) => { d.routes.push({ net, mask, nh, ad: 1 }); };
/** static address for a VPC */
export function hostIp(d: Dev, ip: string, mask: string, gw: string) {
  d.ifaces.eth0.ip = ip; d.ifaces.eth0.mask = mask; d.gw = gw;
}

/** ICMP round trip works (so the return path must work too) */
export const reaches = (s: State, from: string, to: string) => {
  try { return probe(s, from, to, []).kind === "reply"; } catch { return false; }
};
/** an installed route exists on `dev` for net/len, optionally via a specific next hop */
export function hasRoute(s: State, dev: string, net: string, len: number, via?: string) {
  const d = s.devs[dev];
  if (!d) return false;
  return routeTable(s, d).some((r) => r.net === net && r.len === len && (via === undefined || r.via === via));
}

/* ───────── DHCP / addressing helpers ───────── */

/** the device has a real (non link-local) address */
export const hasLease = (s: State, id: string) => {
  const ip = s.devs[id]?.ifaces.eth0?.ip;
  return !!ip && !ip.startsWith("169.254");
};
const inExcluded = (d: Dev, ip: string) =>
  (d.dhcp?.excluded ?? []).some((e) => ip2n(ip) >= ip2n(e.from) && ip2n(ip) <= ip2n(e.to));
export const isExcludedFromPool = (s: State, dev: string, ip: string) => !!s.devs[dev] && inExcluded(s.devs[dev], ip);

/** the server is on and at least one pool still has an address it could hand out */
export function poolHasFree(s: State, dev: string) {
  const d = s.devs[dev];
  if (!d?.dhcp || d.dhcp.off) return false;
  const own = new Set(Object.values(d.ifaces).map((i) => i.ip));
  for (const p of Object.values(d.dhcp.pools)) {
    if (!p.net || !p.mask) continue;
    const first = ip2n(p.net) + 1, last = ip2n(bcastOf(p.net, p.mask)) - 1;
    for (let n = first; n <= last; n++) {
      const ip = n2ip(n);
      if (!inExcluded(d, ip) && !own.has(ip)) return true;
    }
  }
  return false;
}
/** DHCP service is not switched off and a pool exists */
export const dhcpRunning = (s: State, dev: string) => {
  const g = s.devs[dev]?.dhcp;
  return !!g && !g.off && Object.keys(g.pools).length > 0;
};
/** some pool hands out `gw` as the default router */
export const poolGateway = (s: State, dev: string, gw: string) =>
  Object.values(s.devs[dev]?.dhcp?.pools ?? {}).some((p) => p.gw[0] === gw);
/** no address is configured on two different devices */
export function noDuplicateIps(s: State) {
  const seen = new Map<string, string>();
  for (const d of Object.values(s.devs))
    for (const [n, i] of Object.entries(d.ifaces)) {
      if (!i.ip || n.startsWith("Loopback")) continue;
      const other = seen.get(i.ip);
      if (other && other !== d.id) return false;
      seen.set(i.ip, d.id);
    }
  return true;
}

/* ───────── VLAN / trunk helpers (for `init`) ───────── */
/** access port in a VLAN (make sure the VLAN exists too: see addVlan) */
export function accessPort(d: Dev, name: string, vlan: number) {
  const i = (d.ifaces[name] ??= { shut: false });
  i.mode = "access"; i.vlan = vlan;
}
/** trunk port, optionally with an allowed-VLAN list such as "10,20" */
export function trunkPort(d: Dev, name: string, allowed?: string) {
  const i = (d.ifaces[name] ??= { shut: false });
  i.mode = "trunk";
  if (allowed) i.allowed = allowed;
}
export const addVlan = (d: Dev, id: number, name: string) => { d.vlans[id] = name; };
/** router sub-interface for router-on-a-stick; the parent port is brought up too */
export function subIf(d: Dev, name: string, vlan: number, ip: string, mask: string) {
  const parent = name.split(".")[0];
  (d.ifaces[parent] ??= { shut: false }).shut = false;
  d.ifaces[name] = { shut: false, enc: vlan, ip, mask };
}