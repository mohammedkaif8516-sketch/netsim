"use client";

/**
 * Three single-LAN tickets where the fault is on the first hop:
 *
 *   INC-2826 link-shutdown  the switch port was left administratively down   fix: no shutdown
 *   INC-2822 bad-gateway    the laptop's default gateway points at the wrong host   fix: ip <addr>/24 <gateway>
 *   INC-2824 bad-mask       the workstation has the wrong subnet mask         fix: ip <addr>/24 <gateway>
 */
import Router from "@/lib/engine/Router";
import Switch from "@/lib/engine/Switch";
import VPC from "@/lib/engine/VPC";
import { Cable, ifUp } from "@/lib/engine/netsim";
import { M24, hostIp, reaches, setIf } from "./helpers";
import type { Scenario } from "./types";

/* ───────── INC-2826: port left shut after a desk move ───────── */
export const linkShutdown: Scenario = {
  id: "link-shutdown",
  title: "Disabled switch port",
  canvas: { title: "Bengaluru HR floor", width: 840, height: 280 },
  Topology: () => (
    <>
      <Cable a="DESK-PC:eth0" b="HR-FLOOR-SW:Ethernet0/1" />
      <Cable a="HR-FLOOR-SW:Ethernet0/0" b="BLR-HR-GW2:Ethernet0/0" />
      <VPC id="DESK-PC" label="DESK-PC" x={90} y={110} init={(d) => hostIp(d, "10.10.60.25", M24, "10.10.60.1")} />
      <Switch id="HR-FLOOR-SW" label="HR-FLOOR-SW" x={380} y={110} init={(d) => { d.ifaces["Ethernet0/1"].shut = true; /* ← the fault */ }} />
      <Router id="BLR-HR-GW2" label="BLR-HR-GW2" x={680} y={110} init={(d) => setIf(d, "Ethernet0/0", "10.10.60.1", M24)} />
    </>
  ),
  checks: [
    { id: "link", label: "Check the workstation's network link state", test: (s) => ifUp(s, "DESK-PC", "eth0") },
    { id: "port", label: "Find the administratively disabled switch port", test: (s) => s.devs["HR-FLOOR-SW"]?.ifaces["Ethernet0/1"]?.shut === false },
    { id: "gw", label: "Confirm the workstation can reach its default gateway", test: (s) => reaches(s, "DESK-PC", "10.10.60.1") },
  ],
  suggested: [
    { where: "Workstation", commands: ["show ip", "ping 10.10.60.1"] },
    { where: "Switch", commands: ["show interfaces status", "show ip interface brief"] },
  ],
  hints: [
    "The workstation has a valid static address, so the problem is below IP. Is the link actually up?",
    "The desk was moved to a port on HR-FLOOR-SW. Check that port's status: is it administratively down?",
    "Enter `interface Ethernet0/1` on HR-FLOOR-SW, then `no shutdown`.",
  ],
  xp: 100,
};

/* ───────── INC-2822: wrong default gateway on the host ───────── */
export const badGateway: Scenario = {
  id: "bad-gateway",
  title: "Wrong default gateway",
  canvas: { title: "Munich sales office", width: 840, height: 280 },
  Topology: () => (
    <>
      <Cable a="SALES-LT-14:eth0" b="MUC-SALES-GW:Ethernet0/0" />
      <Cable a="MUC-SALES-GW:Ethernet0/1" b="ERP-SRV:eth0" />
      <VPC id="SALES-LT-14" label="SALES-LT-14" x={90} y={110} init={(d) => hostIp(d, "10.50.20.50", M24, "10.50.20.254" /* ← the fault: should be .1 */)} />
      <Router id="MUC-SALES-GW" label="MUC-SALES-GW" x={400} y={110} init={(d) => { setIf(d, "Ethernet0/0", "10.50.20.1", M24); setIf(d, "Ethernet0/1", "10.50.99.1", M24); }} />
      <VPC id="ERP-SRV" label="ERP-SRV" x={710} y={110} init={(d) => hostIp(d, "10.50.99.10", M24, "10.50.99.1")} />
    </>
  ),
  checks: [
    { id: "local", label: "Confirm the laptop can reach its own gateway address", test: (s) => reaches(s, "SALES-LT-14", "10.50.20.1") },
    { id: "gw", label: "Verify the laptop's configured default gateway", test: (s) => s.devs["SALES-LT-14"]?.gw === "10.50.20.1" },
    { id: "erp", label: "Confirm the laptop can reach the application server (10.50.99.10)", test: (s) => reaches(s, "SALES-LT-14", "10.50.99.10") },
  ],
  suggested: [{ where: "Laptop", commands: ["show ip", "ping 10.50.20.1", "ping 10.50.99.10"] }, { where: "Router", commands: ["show ip interface brief"] }],
  hints: [
    "The laptop reaches its neighbours but nothing off-subnet. Check the gateway shown by `show ip`.",
    "Compare that gateway with the router's address on this subnet (`show ip interface brief` on the router).",
    "Reconfigure the laptop: `ip 10.50.20.50/24 10.50.20.1`.",
  ],
  xp: 100,
};

/* ───────── INC-2824: wrong subnet mask ───────── */
export const badMask: Scenario = {
  id: "bad-mask",
  title: "Wrong subnet mask",
  canvas: { title: "Austin Finance floor", width: 840, height: 330 },
  Topology: () => (
    <>
      <Cable a="FIN-WS-12:eth0" b="FIN-SW:Ethernet0/1" />
      <Cable a="FIN-PRN:eth0" b="FIN-SW:Ethernet0/2" />
      <Cable a="FIN-SW:Ethernet0/0" b="FIN-GW:Ethernet0/0" />
      <VPC id="FIN-WS-12" label="FIN-WS-12" x={90} y={60} init={(d) => hostIp(d, "10.30.40.200", "255.255.255.192" /* ← the fault: should be /24 */, "10.30.40.1")} />
      <VPC id="FIN-PRN" label="FIN-PRN" x={90} y={200} init={(d) => hostIp(d, "10.30.40.20", M24, "10.30.40.1")} />
      <Switch id="FIN-SW" label="FIN-SW" x={400} y={130} />
      <Router id="FIN-GW" label="FIN-GW" x={700} y={130} init={(d) => setIf(d, "Ethernet0/0", "10.30.40.1", M24)} />
    </>
  ),
  checks: [
    { id: "gw", label: "Confirm the workstation can reach its default gateway", test: (s) => reaches(s, "FIN-WS-12", "10.30.40.1") },
    { id: "mask", label: "Verify the workstation's subnet mask matches the network (/24)", test: (s) => s.devs["FIN-WS-12"]?.ifaces.eth0.mask === M24 },
    { id: "prn", label: "Confirm the workstation can reach the department printer", test: (s) => reaches(s, "FIN-WS-12", "10.30.40.20") },
  ],
  suggested: [{ where: "Workstation", commands: ["show ip", "ping 10.30.40.1", "ping 10.30.40.20"] }, { where: "Printer", commands: ["show ip"] }],
  hints: [
    "The workstation can't reach the gateway or the printer, although the cabling is fine. Compare `show ip` on the workstation with the printer's.",
    "Look at the IP/MASK column. Is the workstation's prefix the same length as the printer's?",
    "Reconfigure it: `ip 10.30.40.200/24 10.30.40.1`.",
  ],
  xp: 100,
};