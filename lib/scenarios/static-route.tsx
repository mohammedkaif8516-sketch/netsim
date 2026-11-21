"use client";

/**
 * INC-2819 — Remote office cannot reach HR (Austin · Human Resources).
 *
 *   REM-PC ── REMOTE-R ══ HQ-R ── HR-SRV
 *   10.30.50.0/24     172.16.0.0/30     10.30.10.0/24
 *
 * Injected fault: REMOTE-R's static route to the HR subnet has a typo (10.30.1.0 instead of 10.30.10.0).
 * HQ-R already has the return route. Fix on REMOTE-R:
 *   ip route 10.30.10.0 255.255.255.0 172.16.0.1
 * Removing the typo'd route (no ip route 10.30.1.0 ...) is good hygiene but not required: it is a different prefix.
 */
import Router from "@/lib/engine/Router";
import VPC from "@/lib/engine/VPC";
import { Cable } from "@/lib/engine/netsim";
import { M24, M30, addRoute, hasRoute, hostIp, reaches, setIf } from "./helpers";
import type { Scenario } from "./types";

const PC = "REM-PC", SRV = "HR-SRV", REMOTE = "REMOTE-R";

function Topology() {
  return (
    <>
      <Cable a="REM-PC:eth0" b="REMOTE-R:Ethernet0/1" />
      <Cable a="REMOTE-R:Ethernet0/0" b="HQ-R:Ethernet0/1" />
      <Cable a="HQ-R:Ethernet0/0" b="HR-SRV:eth0" />
      <VPC id={PC} label={PC} x={60} y={110} init={(d) => hostIp(d, "10.30.50.20", M24, "10.30.50.1")} />
      <Router id={REMOTE} label={REMOTE} x={290} y={110} init={(d) => {
        setIf(d, "Ethernet0/1", "10.30.50.1", M24);
        setIf(d, "Ethernet0/0", "172.16.0.2", M30);
        addRoute(d, "10.30.1.0", M24, "172.16.0.1"); // ← the fault: should be 10.30.10.0
      }} />
      <Router id="HQ-R" label="HQ-R" x={520} y={110} init={(d) => {
        setIf(d, "Ethernet0/0", "10.30.10.1", M24);
        setIf(d, "Ethernet0/1", "172.16.0.1", M30);
        addRoute(d, "10.30.50.0", M24, "172.16.0.2");
      }} />
      <VPC id={SRV} label={SRV} x={750} y={110} init={(d) => hostIp(d, "10.30.10.10", M24, "10.30.10.1")} />
    </>
  );
}

export const staticRoute: Scenario = {
  id: "static-route",
  title: "Static route to HR",
  canvas: { title: "Remote office WAN", width: 840, height: 280 },
  Topology,
  checks: [
    { id: "lan", label: "Confirm the remote PC can reach its own gateway", test: (s) => reaches(s, PC, "10.30.50.1") },
    { id: "route", label: "Find and fix the static route to the HR subnet on REMOTE-R", test: (s) => hasRoute(s, REMOTE, "10.30.10.0", 24, "172.16.0.1") },
    { id: "hr", label: "Confirm the remote PC can reach the HR server", test: (s) => reaches(s, PC, "10.30.10.10") },
  ],
  suggested: [
    { where: "Remote PC", commands: ["ping 10.30.10.10", "trace 10.30.10.10"] },
    { where: "REMOTE-R", commands: ["show ip route", "show running-config"] },
  ],
  hints: [
    "The remote LAN works, and the WAN link is up. The problem is in how REMOTE-R learns about the HR subnet.",
    "Compare the static route in `show running-config` with the HR subnet on HQ-R (10.30.10.0/24). Look closely at the digits.",
    "Add the correct route: `ip route 10.30.10.0 255.255.255.0 172.16.0.1`. Then remove the typo'd one with `no ip route 10.30.1.0 255.255.255.0 172.16.0.1` to keep the config clean.",
  ],
  xp: 150,
};