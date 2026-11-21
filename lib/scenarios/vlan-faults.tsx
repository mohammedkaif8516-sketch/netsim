"use client";

/**
 * Five Layer-2 tickets:
 *
 *   INC-2804 vlan-access    two scanner ports were left in the office VLAN        fix: switchport access vlan 20
 *   INC-2835 vlan-missing   the replacement switch has no VLAN 40 in its database fix: vlan 40
 *   INC-2802 trunk-allowed  the uplink trunk does not allow the new floor's VLAN  fix: switchport trunk allowed vlan add 30
 *   INC-2800 vtp-client     the new switch is in the wrong VTP domain             fix: vtp domain MERIDIAN
 *   INC-2798 inter-vlan     router sub-interface uses the wrong dot1q tag         fix: encapsulation dot1q 20
 */
import Router from "@/lib/engine/Router";
import Switch from "@/lib/engine/Switch";
import VPC from "@/lib/engine/VPC";
import { Cable, ifUp, operMode, vlanAllowed } from "@/lib/engine/netsim";
import { M24, accessPort, addVlan, hostIp, reaches, setIf, subIf, trunkPort } from "./helpers";
import type { Scenario } from "./types";

/* ───────── INC-2804 ───────── */
export const vlanAccess: Scenario = {
  id: "vlan-access",
  title: "Scanners in the wrong VLAN",
  canvas: { title: "Munich warehouse switch", width: 700, height: 340 },
  Topology: () => (
    <>
      <Cable a="WH-GW3:Ethernet0/0" b="WH-SW3:Ethernet0/0" />
      <Cable a="WH-SW3:Ethernet0/1" b="SCN-01:eth0" />
      <Cable a="WH-SW3:Ethernet0/2" b="SCN-02:eth0" />
      <Cable a="WH-SW3:Ethernet0/3" b="WMS-SRV:eth0" />
      <Router id="WH-GW3" label="WH-GW3" x={92} y={130} init={(d) => setIf(d, "Ethernet0/0", "10.60.30.1", M24)} />
      <Switch id="WH-SW3" label="WH-SW3" x={320} y={130} init={(d) => {
        addVlan(d, 10, "OFFICE"); addVlan(d, 20, "WAREHOUSE");
        accessPort(d, "Ethernet0/0", 20);
        accessPort(d, "Ethernet0/1", 10); // ← the fault: scanners left in the office VLAN
        accessPort(d, "Ethernet0/2", 10); // ←
        accessPort(d, "Ethernet0/3", 20);
      }} />
      <VPC id="SCN-01" label="SCN-01" x={540} y={40} init={(d) => hostIp(d, "10.60.30.51", M24, "10.60.30.1")} />
      <VPC id="SCN-02" label="SCN-02" x={540} y={140} init={(d) => hostIp(d, "10.60.30.52", M24, "10.60.30.1")} />
      <VPC id="WMS-SRV" label="WMS-SRV" x={540} y={240} init={(d) => hostIp(d, "10.60.30.10", M24, "10.60.30.1")} />
    </>
  ),
  checks: [
    { id: "vlan", label: "Verify both scanner ports are in the warehouse VLAN (20)", test: (s) => ["Ethernet0/1", "Ethernet0/2"].every((p) => s.devs["WH-SW3"]?.ifaces[p]?.vlan === 20) },
    { id: "gw", label: "Confirm SCN-01 can reach the warehouse gateway", test: (s) => reaches(s, "SCN-01", "10.60.30.1") },
    { id: "wms", label: "Confirm SCN-02 can reach the warehouse system (WMS-SRV)", test: (s) => reaches(s, "SCN-02", "10.60.30.10") },
  ],
  suggested: [{ where: "Scanner", commands: ["ping 10.60.30.1"] }, { where: "Switch", commands: ["show vlan brief", "show interfaces status"] }],
  hints: [
    "The scanners are cabled and powered on but can't reach anything. Layer 2 first: which VLAN is each port in?",
    "`show vlan brief` lists the ports per VLAN. The gateway and WMS server are in VLAN 20: where are the scanners?",
    "On WH-SW3 enter each scanner port (Ethernet0/1 and Ethernet0/2) and run `switchport access vlan 20`.",
  ],
  xp: 150,
};

/* ───────── INC-2835 ───────── */
export const vlanMissing: Scenario = {
  id: "vlan-missing",
  title: "VLAN missing after a switch swap",
  canvas: { title: "Munich warehouse (replacement switch)", width: 700, height: 380 },
  Topology: () => (
    <>
      <Cable a="WH-GW4:Ethernet0/0" b="WH-SW4:Ethernet0/0" />
      <Cable a="WH-SW4:Ethernet0/1" b="OFFICE-PC:eth0" />
      <Cable a="WH-SW4:Ethernet0/2" b="SCN-11:eth0" />
      <Cable a="WH-SW4:Ethernet0/3" b="SCN-12:eth0" />
      <Router id="WH-GW4" label="WH-GW4" x={92} y={170} init={(d) => {
        subIf(d, "Ethernet0/0.10", 10, "10.60.10.1", M24);
        subIf(d, "Ethernet0/0.40", 40, "10.60.40.1", M24);
      }} />
      <Switch id="WH-SW4" label="WH-SW4 (new)" x={320} y={170} init={(d) => {
        addVlan(d, 10, "OFFICE"); // ← the fault: VLAN 40 was never created on the replacement switch
        trunkPort(d, "Ethernet0/0");
        accessPort(d, "Ethernet0/1", 10);
        accessPort(d, "Ethernet0/2", 40);
        accessPort(d, "Ethernet0/3", 40);
      }} />
      <VPC id="OFFICE-PC" label="OFFICE-PC" x={540} y={50} init={(d) => hostIp(d, "10.60.10.50", M24, "10.60.10.1")} />
      <VPC id="SCN-11" label="SCN-11" x={540} y={170} init={(d) => hostIp(d, "10.60.40.51", M24, "10.60.40.1")} />
      <VPC id="SCN-12" label="SCN-12" x={540} y={290} init={(d) => hostIp(d, "10.60.40.52", M24, "10.60.40.1")} />
    </>
  ),
  checks: [
    { id: "office", label: "Confirm the office PC can reach its gateway", test: (s) => reaches(s, "OFFICE-PC", "10.60.10.1") },
    { id: "vlan", label: "Verify VLAN 40 exists on the replacement switch", test: (s) => !!s.devs["WH-SW4"]?.vlans[40] },
    { id: "scn", label: "Confirm both scanners can reach their gateway", test: (s) => ["SCN-11", "SCN-12"].every((c) => reaches(s, c, "10.60.40.1")) },
  ],
  suggested: [{ where: "Scanner", commands: ["ping 10.60.40.1"] }, { where: "Switch", commands: ["show vlan brief", "show interfaces trunk"] }],
  hints: [
    "The office PC works, so the uplink and router are fine. What differs about the scanners' VLAN?",
    "Run `show vlan brief` on the new switch and compare it with the VLAN the scanner ports use.",
    "A port can't carry a VLAN that isn't in the database. Create it with `vlan 40` (and `name SCANNERS`).",
  ],
  xp: 150,
};

/* ───────── INC-2802 ───────── */
const ALLOWED_BAD = "10,20";
export const trunkAllowed: Scenario = {
  id: "trunk-allowed",
  title: "VLAN blocked on the uplink trunk",
  canvas: { title: "Austin Finance, new floor", width: 800, height: 300 },
  Topology: () => (
    <>
      <Cable a="FIN3-GW:Ethernet0/0" b="DIST-SW:Ethernet0/0" />
      <Cable a="DIST-SW:Ethernet0/1" b="FLOOR3-SW:Ethernet0/0" />
      <Cable a="FLOOR3-SW:Ethernet0/1" b="FLOOR-PC1:eth0" />
      <Cable a="FLOOR3-SW:Ethernet0/2" b="FLOOR-PC2:eth0" />
      <Router id="FIN3-GW" label="FIN3-GW" x={70} y={110} init={(d) => subIf(d, "Ethernet0/0.30", 30, "10.80.30.1", M24)} />
      <Switch id="DIST-SW" label="DIST-SW" x={270} y={110} init={(d) => {
        addVlan(d, 30, "FLOOR3");
        trunkPort(d, "Ethernet0/0");
        trunkPort(d, "Ethernet0/1", ALLOWED_BAD); // ← the fault: VLAN 30 is not allowed
      }} />
      <Switch id="FLOOR3-SW" label="FLOOR3-SW" x={470} y={110} init={(d) => {
        addVlan(d, 30, "FLOOR3");
        trunkPort(d, "Ethernet0/0");
        accessPort(d, "Ethernet0/1", 30);
        accessPort(d, "Ethernet0/2", 30);
      }} />
      <VPC id="FLOOR-PC1" label="FLOOR-PC1" x={680} y={50} init={(d) => hostIp(d, "10.80.30.51", M24, "10.80.30.1")} />
      <VPC id="FLOOR-PC2" label="FLOOR-PC2" x={680} y={170} init={(d) => hostIp(d, "10.80.30.52", M24, "10.80.30.1")} />
    </>
  ),
  checks: [
    { id: "local", label: "Confirm the two floor PCs can reach each other", test: (s) => reaches(s, "FLOOR-PC1", "10.80.30.52") },
    { id: "trunk", label: "Verify VLAN 30 is allowed on the uplink trunk", test: (s) => vlanAllowed(s.devs["DIST-SW"]?.ifaces["Ethernet0/1"]?.allowed, 30) && vlanAllowed(s.devs["FLOOR3-SW"]?.ifaces["Ethernet0/0"]?.allowed, 30) },
    { id: "gw", label: "Confirm the floor PCs can reach their gateway", test: (s) => ["FLOOR-PC1", "FLOOR-PC2"].every((c) => reaches(s, c, "10.80.30.1")) },
  ],
  suggested: [{ where: "PC", commands: ["ping 10.80.30.1", "ping 10.80.30.52"] }, { where: "Switches", commands: ["show interfaces trunk", "show vlan brief"] }],
  hints: [
    "Local traffic works inside the floor switch, so the problem is between the switches. Start with the trunk.",
    "`show interfaces trunk` on each switch shows which VLANs are allowed. Is VLAN 30 in the list on the DIST-SW side?",
    "On DIST-SW, enter `interface Ethernet0/1` and run `switchport trunk allowed vlan add 30`.",
  ],
  xp: 150,
};

/* ───────── INC-2800 ───────── */
export const vtpClient: Scenario = {
  id: "vtp-client",
  title: "VTP domain mismatch",
  canvas: { title: "Bengaluru HR, new access switch", width: 840, height: 280 },
  Topology: () => (
    <>
      <Cable a="BLR-HR-RTR:Ethernet0/0" b="BLR-DIST-SW:Ethernet0/2" />
      <Cable a="BLR-DIST-SW:Ethernet0/0" b="BLR-ACC-SW:Ethernet0/0" />
      <Cable a="BLR-ACC-SW:Ethernet0/1" b="HR-PC-31:eth0" />
      <Router id="BLR-HR-RTR" label="BLR-HR-RTR" x={90} y={110} init={(d) => setIf(d, "Ethernet0/0", "10.10.70.1", M24)} />
      <Switch id="BLR-DIST-SW" label="BLR-DIST-SW" x={330} y={110} init={(d) => {
        addVlan(d, 40, "HR");
        trunkPort(d, "Ethernet0/0");
        accessPort(d, "Ethernet0/2", 40);
        d.vtp = { mode: "server", version: 2, rev: 3, domain: "MERIDIAN", sig: JSON.stringify(d.vlans) };
      }} />
      <Switch id="BLR-ACC-SW" label="BLR-ACC-SW (new)" x={570} y={110} init={(d) => {
        trunkPort(d, "Ethernet0/0");
        accessPort(d, "Ethernet0/1", 40);
        d.vtp = { mode: "client", version: 2, rev: 0, domain: "MERIDIAN-HR" }; // ← the fault: wrong domain
      }} />
      <VPC id="HR-PC-31" label="HR-PC-31" x={770} y={110} init={(d) => hostIp(d, "10.10.70.31", M24, "10.10.70.1")} />
    </>
  ),
  checks: [
    { id: "trunk", label: "Check the trunk between the two switches is up", test: (s) => ifUp(s, "BLR-ACC-SW", "Ethernet0/0") && operMode(s, "BLR-ACC-SW", "Ethernet0/0") === "trunk" && operMode(s, "BLR-DIST-SW", "Ethernet0/0") === "trunk" },
    { id: "vlan", label: "Verify VLAN 40 exists on the new access switch", test: (s) => !!s.devs["BLR-ACC-SW"]?.vlans[40] },
    { id: "pc", label: "Confirm the HR PC can reach its gateway", test: (s) => reaches(s, "HR-PC-31", "10.10.70.1") },
  ],
  suggested: [{ where: "Both switches", commands: ["show vtp status", "show vlan brief"] }, { where: "HR PC", commands: ["ping 10.10.70.1"] }],
  hints: [
    "The trunk is fine but the VLAN never arrived. VLANs reach client switches through VTP. Compare `show vtp status` on both switches.",
    "Look at the VTP domain names. A client only accepts updates from its own domain. (`vlan 40` won't work on a client switch.)",
    "On BLR-ACC-SW run `vtp domain MERIDIAN`. It will then learn the VLAN from the distribution switch.",
  ],
  xp: 100,
};

/* ───────── INC-2798 ───────── */
export const interVlan: Scenario = {
  id: "inter-vlan",
  title: "Inter-VLAN routing",
  canvas: { title: "Austin router-on-a-stick", width: 700, height: 300 },
  Topology: () => (
    <>
      <Cable a="IV-GW:Ethernet0/0" b="IV-SW:Ethernet0/0" />
      <Cable a="IV-SW:Ethernet0/1" b="FIN-PC:eth0" />
      <Cable a="IV-SW:Ethernet0/2" b="HR-SRV2:eth0" />
      <Router id="IV-GW" label="IV-GW" x={92} y={110} init={(d) => {
        subIf(d, "Ethernet0/0.10", 10, "10.80.10.1", M24);
        subIf(d, "Ethernet0/0.20", 200, "10.80.20.1", M24); // ← the fault: should be dot1q 20
      }} />
      <Switch id="IV-SW" label="IV-SW" x={320} y={110} init={(d) => {
        addVlan(d, 10, "FINANCE"); addVlan(d, 20, "HR");
        trunkPort(d, "Ethernet0/0");
        accessPort(d, "Ethernet0/1", 10);
        accessPort(d, "Ethernet0/2", 20);
      }} />
      <VPC id="FIN-PC" label="FIN-PC" x={540} y={50} init={(d) => hostIp(d, "10.80.10.50", M24, "10.80.10.1")} />
      <VPC id="HR-SRV2" label="HR-SRV" x={540} y={170} init={(d) => hostIp(d, "10.80.20.10", M24, "10.80.20.1")} />
    </>
  ),
  checks: [
    { id: "gw", label: "Confirm the Finance PC can reach its own gateway", test: (s) => reaches(s, "FIN-PC", "10.80.10.1") },
    { id: "tag", label: "Verify each router sub-interface uses the right VLAN tag", test: (s) => s.devs["IV-GW"]?.ifaces["Ethernet0/0.10"]?.enc === 10 && s.devs["IV-GW"]?.ifaces["Ethernet0/0.20"]?.enc === 20 },
    { id: "hr", label: "Confirm the Finance PC can reach the HR server", test: (s) => reaches(s, "FIN-PC", "10.80.20.10") },
  ],
  suggested: [{ where: "Finance PC", commands: ["ping 10.80.10.1", "ping 10.80.20.10"] }, { where: "Router", commands: ["show ip interface brief", "show running-config"] }],
  hints: [
    "Finance reaches its own gateway, but traffic to the HR VLAN fails. The router has to route between the two VLANs.",
    "Check each sub-interface in `show running-config`. Does its `encapsulation dot1q` number match the VLAN?",
    "On IV-GW: `interface Ethernet0/0.20` then `encapsulation dot1q 20`.",
  ],
  xp: 150,
};