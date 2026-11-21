"use client";

/**
 * INC-2815 — Office users cannot reach the internet (Bengaluru · Sales).
 *
 *   SALES-PC ── SALES-SW ── BLR-GW ══ ISP-R (Loopback0 = 8.8.8.8, "the internet")
 *
 * Injected fault: BLR-GW has no default route. The ISP router is already correct (it can route back).
 * Fix:  ip route 0.0.0.0 0.0.0.0 203.0.113.1   (on BLR-GW)
 */
import Router from "@/lib/engine/Router";
import Switch from "@/lib/engine/Switch";
import VPC from "@/lib/engine/VPC";
import { Cable } from "@/lib/engine/netsim";
import { M24, M30, M32, addRoute, hasRoute, hostIp, reaches, setIf } from "./helpers";
import type { Scenario } from "./types";

const PC = "SALES-PC", GW = "BLR-GW", INTERNET = "8.8.8.8";

function Topology() {
  return (
    <>
      <Cable a="SALES-PC:eth0" b="SALES-SW:Ethernet0/1" />
      <Cable a="SALES-SW:Ethernet0/0" b="BLR-GW:Ethernet0/0" />
      <Cable a="BLR-GW:Ethernet0/1" b="ISP-R:Ethernet0/0" />
      <VPC id={PC} label={PC} x={60} y={110} init={(d) => hostIp(d, "10.20.30.50", M24, "10.20.30.1")} />
      <Switch id="SALES-SW" label="SALES-SW" x={290} y={110} />
      <Router id={GW} label={GW} x={520} y={110} init={(d) => {
        setIf(d, "Ethernet0/0", "10.20.30.1", M24);
        setIf(d, "Ethernet0/1", "203.0.113.2", M30);
        // ↓ the fault: no default route configured
      }} />
      <Router id="ISP-R" label="ISP-R" x={750} y={110} init={(d) => {
        setIf(d, "Ethernet0/0", "203.0.113.1", M30);
        setIf(d, "Loopback0", INTERNET, M32);
        addRoute(d, "10.20.30.0", M24, "203.0.113.2");
      }} />
    </>
  );
}

export const defaultRoute: Scenario = {
  id: "default-route",
  title: "Missing default route",
  canvas: { title: "Sales office uplink", width: 840, height: 280 },
  Topology,
  checks: [
    { id: "lan", label: "Confirm the workstation can reach its local gateway", test: (s) => reaches(s, PC, "10.20.30.1") },
    { id: "route", label: "Check the gateway's routing table for a default route", test: (s) => hasRoute(s, GW, "0.0.0.0", 0, "203.0.113.1") },
    { id: "internet", label: "Confirm the workstation can reach the internet (8.8.8.8)", test: (s) => reaches(s, PC, INTERNET) },
  ],
  suggested: [
    { where: "Workstation", commands: ["ping 10.20.30.1", "ping 8.8.8.8", "trace 8.8.8.8"] },
    { where: "Router", commands: ["show ip route", "show ip interface brief"] },
  ],
  hints: [
    "Internal traffic works, so the workstation and switch are fine. Where does the first router send traffic it has no specific route for?",
    "Run `show ip route` on BLR-GW. Is there a line starting with S* or a route to 0.0.0.0/0?",
    "Add a default route toward the ISP: `ip route 0.0.0.0 0.0.0.0 203.0.113.1` in config mode.",
  ],
  xp: 100,
};