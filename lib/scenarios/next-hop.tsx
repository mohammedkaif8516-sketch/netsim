"use client";

/**
 * INC-2817 — Warehouse traffic is sent to the wrong router (Munich · Warehouse).
 *
 *                      ┌─ DC-R1 ── DC-SRV      (correct path, 10.40.1.0/30)
 *   WH-PC ── WH-GW ────┤
 *                      └─ OLD-R                (wrong path, 10.40.2.0/30, no route to the data center)
 *
 * Injected fault: WH-GW's route to 10.60.0.0/24 points at OLD-R (10.40.2.2) instead of DC-R1 (10.40.1.2).
 * Fix on WH-GW:
 *   no ip route 10.60.0.0 255.255.255.0 10.40.2.2
 *   ip route 10.60.0.0 255.255.255.0 10.40.1.2
 * (adding the new route without removing the old one does not work: the first one stays installed)
 */
import Router from "@/lib/engine/Router";
import VPC from "@/lib/engine/VPC";
import { Cable } from "@/lib/engine/netsim";
import { M24, M30, addRoute, hasRoute, hostIp, reaches, setIf } from "./helpers";
import type { Scenario } from "./types";

const PC = "WH-PC", GW = "WH-GW", DC = "10.60.0.10";

function Topology() {
  return (
    <>
      <Cable a="WH-PC:eth0" b="WH-GW:Ethernet0/0" />
      <Cable a="WH-GW:Ethernet0/1" b="DC-R1:Ethernet0/0" />
      <Cable a="WH-GW:Ethernet0/2" b="OLD-R:Ethernet0/0" />
      <Cable a="DC-R1:Ethernet0/1" b="DC-SRV:eth0" />
      <VPC id={PC} label={PC} x={60} y={170} init={(d) => hostIp(d, "10.40.10.50", M24, "10.40.10.1")} />
      <Router id={GW} label={GW} x={290} y={170} init={(d) => {
        setIf(d, "Ethernet0/0", "10.40.10.1", M24);
        setIf(d, "Ethernet0/1", "10.40.1.1", M30);
        setIf(d, "Ethernet0/2", "10.40.2.1", M30);
        addRoute(d, "10.60.0.0", M24, "10.40.2.2"); // ← the fault: should be 10.40.1.2 (DC-R1)
      }} />
      <Router id="DC-R1" label="DC-R1" x={520} y={70} init={(d) => {
        setIf(d, "Ethernet0/0", "10.40.1.2", M30);
        setIf(d, "Ethernet0/1", "10.60.0.1", M24);
        addRoute(d, "10.40.10.0", M24, "10.40.1.1");
      }} />
      <Router id="OLD-R" label="OLD-R (decommissioned)" x={520} y={270} init={(d) => {
        setIf(d, "Ethernet0/0", "10.40.2.2", M30);
      }} />
      <VPC id="DC-SRV" label="DC-SRV" x={750} y={70} init={(d) => hostIp(d, "10.60.0.10", M24, "10.60.0.1")} />
    </>
  );
}

export const nextHop: Scenario = {
  id: "next-hop",
  title: "Wrong next hop",
  canvas: { title: "Munich warehouse uplinks", width: 840, height: 350 },
  Topology,
  checks: [
    { id: "lan", label: "Confirm the warehouse PC can reach its local gateway", test: (s) => reaches(s, PC, "10.40.10.1") },
    { id: "route", label: "Make the data-center route use the correct next hop (DC-R1)", test: (s) => hasRoute(s, GW, "10.60.0.0", 24, "10.40.1.2") },
    { id: "dc", label: "Confirm the warehouse PC can reach the data-center server", test: (s) => reaches(s, PC, DC) },
  ],
  suggested: [
    { where: "Warehouse PC", commands: ["ping 10.60.0.10", "trace 10.60.0.10"] },
    { where: "WH-GW", commands: ["show ip route", "show ip interface brief"] },
  ],
  hints: [
    "The warehouse PC reaches its gateway, so look at where WH-GW sends traffic for the data center. `trace` shows which router it goes to.",
    "WH-GW has two uplinks. Check which next-hop address its route to 10.60.0.0/24 uses, and which router owns that address.",
    "Delete the route with `no ip route 10.60.0.0 255.255.255.0 10.40.2.2` first, then add it via 10.40.1.2.",
  ],
  xp: 150,
};