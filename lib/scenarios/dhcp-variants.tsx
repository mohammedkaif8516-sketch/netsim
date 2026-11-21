"use client";

/**
 * Four DHCP tickets that share the same layout but break something different:
 *
 *   INC-2812 dhcp-exhausted  every address in the pool is excluded            fix: narrow the excluded range
 *   INC-2810 dhcp-router     pool hands out the wrong default router          fix: default-router, then renew
 *   INC-2808 dhcp-service    `no service dhcp` on the server                  fix: service dhcp
 *   INC-2806 dhcp-conflict   a static printer sits on the first free address  fix: exclude it, release + renew
 */
import { Cable, type Dev } from "@/lib/engine/netsim";
import VPC from "@/lib/engine/VPC";
import { M24, dhcpRunning, hasLease, hostIp, isExcludedFromPool, noDuplicateIps, poolGateway, poolHasFree, reaches } from "./helpers";
import { DHCP_CANVAS, DhcpLan } from "./parts";
import type { Scenario } from "./types";

const pool = (net: string, gw: string): Dev["dhcp"] => ({
  pools: { LAN: { net, mask: "255.255.255.0", gw: [gw], dns: ["10.0.0.53"] } },
  excluded: [{ from: gw, to: gw.replace(/\.\d+$/, ".10") }],
});
const renew = "Then run `ip dhcp` on each workstation to get a fresh lease.";

/* ───────── INC-2812: pool exhausted ───────── */
const ex = { gw: "AUS-HR-GW", sw: "AUS-HR-SW", c: ["AUS-HR-LT-1", "AUS-HR-LT-2"] as [string, string] };
export const dhcpExhausted: Scenario = {
  id: "dhcp-exhausted",
  title: "DHCP pool has no free addresses",
  canvas: DHCP_CANVAS("Austin HR access network"),
  Topology: () => (
    <DhcpLan gw={ex.gw} sw={ex.sw} clients={ex.c} lanIp="10.70.10.1" setupGw={(d) => {
      d.dhcp = { pools: { LAN: { net: "10.70.10.0", mask: M24, gw: ["10.70.10.1"], dns: ["10.0.0.53"] } }, excluded: [{ from: "10.70.10.1", to: "10.70.10.254" }] };
    }} />
  ),
  checks: [
    { id: "lease", label: "Check whether the laptops received valid IP addresses", test: (s) => ex.c.every((c) => hasLease(s, c)) },
    { id: "free", label: "Verify the pool still has addresses available to lease", test: (s) => poolHasFree(s, ex.gw) },
    { id: "gw", label: "Confirm the laptops can reach their default gateway", test: (s) => ex.c.every((c) => reaches(s, c, "10.70.10.1")) },
  ],
  suggested: [
    { where: "Router", commands: ["show ip dhcp pool", "show running-config"] },
    { where: "Workstation", commands: ["ip dhcp", "show ip"] },
  ],
  hints: [
    "The pool exists and the service is on, yet nothing is leased. Look at the pool's utilisation, and at what else is configured for DHCP.",
    "In `show running-config`, check the `ip dhcp excluded-address` lines. How much of the pool do they cover?",
    `Remove the range with \`no ip dhcp excluded-address 10.70.10.1 10.70.10.254\`, then exclude only the router's block (10.70.10.1 to 10.70.10.10). ${renew}`,
  ],
  xp: 150,
};

/* ───────── INC-2810: wrong default router ───────── */
const rt = { gw: "BLR-HR-GW", sw: "BLR-HR-SW", c: ["NEWHIRE-1", "NEWHIRE-2"] as [string, string], srv: "HR-APPS" };
export const dhcpRouter: Scenario = {
  id: "dhcp-router",
  title: "DHCP hands out the wrong gateway",
  canvas: DHCP_CANVAS("Bengaluru HR access network", true),
  Topology: () => (
    <DhcpLan gw={rt.gw} sw={rt.sw} clients={rt.c} lanIp="10.10.40.1" server={{ id: rt.srv, ip: "10.10.90.10", gwIp: "10.10.90.1" }}
      setupGw={(d) => { d.dhcp = pool("10.10.40.0", "10.10.40.254"); }}
      initClient={(id, d) => hostIp(d, id === rt.c[0] ? "10.10.40.21" : "10.10.40.22", M24, "10.10.40.254")} />
  ),
  checks: [
    { id: "lease", label: "Check that the new hires have valid addresses", test: (s) => rt.c.every((c) => hasLease(s, c)) },
    { id: "gw", label: "Verify the pool's default router matches the gateway (10.10.40.1)", test: (s) => poolGateway(s, rt.gw, "10.10.40.1") },
    { id: "apps", label: "Confirm the new hires can reach the HR applications server", test: (s) => rt.c.every((c) => reaches(s, c, "10.10.90.10")) },
  ],
  suggested: [
    { where: "Workstation", commands: ["show ip", "ping 10.10.90.10"] },
    { where: "Router", commands: ["show ip interface brief", "show running-config"] },
  ],
  hints: [
    "The laptops have addresses but only reach their own subnet. Compare the gateway shown by `show ip` with the router's interface address.",
    "The gateway comes from the pool's `default-router`. Does it match 10.10.40.1?",
    `Fix it under \`ip dhcp pool LAN\` with \`default-router 10.10.40.1\`. ${renew}`,
  ],
  xp: 100,
};

/* ───────── INC-2808: service disabled ───────── */
const sv = { gw: "AUS-FIN-GW", sw: "AUS-FIN-SW", c: ["FIN-WS-31", "FIN-WS-32"] as [string, string] };
export const dhcpService: Scenario = {
  id: "dhcp-service",
  title: "DHCP service disabled",
  canvas: DHCP_CANVAS("Austin Finance access network"),
  Topology: () => (
    <DhcpLan gw={sv.gw} sw={sv.sw} clients={sv.c} lanIp="10.80.5.1" setupGw={(d) => {
      d.dhcp = { ...pool("10.80.5.0", "10.80.5.1")!, off: true };
    }} />
  ),
  checks: [
    { id: "lease", label: "Check whether new workstations can obtain an address", test: (s) => sv.c.every((c) => hasLease(s, c)) },
    { id: "svc", label: "Verify the DHCP service is running on the router", test: (s) => dhcpRunning(s, sv.gw) },
    { id: "gw", label: "Confirm the workstations can reach their default gateway", test: (s) => sv.c.every((c) => reaches(s, c, "10.80.5.1")) },
  ],
  suggested: [
    { where: "Router", commands: ["show ip dhcp pool", "show running-config"] },
    { where: "Workstation", commands: ["ip dhcp"] },
  ],
  hints: [
    "The pool looks right, but nothing answers. Is the DHCP server itself switched on?",
    "Look for `no service dhcp` near the top of `show running-config`.",
    `Enable it with \`service dhcp\` in config mode. ${renew}`,
  ],
  xp: 100,
};

/* ───────── INC-2806: address conflict ───────── */
const cf = { gw: "MUC-WH-GW", sw: "MUC-WH-SW", c: ["WH-WS-07", "WH-WS-08"] as [string, string], prn: "WH-PRN", prnIp: "10.60.20.11" };
export const dhcpConflict: Scenario = {
  id: "dhcp-conflict",
  title: "DHCP address conflict",
  canvas: DHCP_CANVAS("Munich warehouse access network"),
  Topology: () => (
    <DhcpLan gw={cf.gw} sw={cf.sw} clients={cf.c} lanIp="10.60.20.1" setupGw={(d) => { d.dhcp = pool("10.60.20.0", "10.60.20.1"); }}
      initClient={(id, d) => { if (id === cf.c[0]) hostIp(d, cf.prnIp, M24, "10.60.20.1"); }}
      extra={<>
        <Cable a={`${cf.sw}:Ethernet0/3`} b={`${cf.prn}:eth0`} />
        <VPC id={cf.prn} label={cf.prn} x={320} y={240} init={(d) => hostIp(d, cf.prnIp, M24, "10.60.20.1")} />
      </>} />
  ),
  checks: [
    { id: "gw", label: "Confirm the workstation can reach its default gateway", test: (s) => reaches(s, cf.c[0], "10.60.20.1") },
    { id: "excl", label: "Exclude the printer's static address from the DHCP pool", test: (s) => isExcludedFromPool(s, cf.gw, cf.prnIp) },
    { id: "dup", label: "Confirm no two devices share an IP address", test: (s) => noDuplicateIps(s) },
  ],
  suggested: [
    { where: "Workstations", commands: ["show ip"] },
    { where: "Printer", commands: ["show ip"] },
    { where: "Router", commands: ["show ip dhcp binding", "show running-config"] },
  ],
  hints: [
    "Compare the address on WH-WS-07 with the printer's. Which device was configured by hand?",
    "The pool is leasing an address that a printer already uses by hand. Exclude that address from the pool.",
    `\`ip dhcp excluded-address ${cf.prnIp}\` on the router, then on WH-WS-07 run \`ip dhcp -r\` and \`ip dhcp\` to move it to a free address.`,
  ],
  xp: 100,
};