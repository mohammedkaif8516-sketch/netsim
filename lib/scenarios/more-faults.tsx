"use client";

/**
 *   INC-2838 missing-return  the data-center router has no route back to Finance  fix: ip route 10.90.10.0 255.255.255.0 10.90.1.1
 *   INC-2829 printer-gateway the printer's default gateway is wrong                fix: ip 10.20.50.20/24 10.20.50.1
 *
 * Both show the "request arrives, reply is lost" pattern: pings TIME OUT instead of reporting "unreachable".
 */
import Router from "@/lib/engine/Router";
import VPC from "@/lib/engine/VPC";
import { Cable } from "@/lib/engine/netsim";
import { M24, M30, addRoute, hasRoute, hostIp, reaches, setIf } from "./helpers";
import type { Scenario } from "./types";

export const missingReturn: Scenario = {
  id: "missing-return",
  title: "No return route",
  canvas: { title: "Finance to data center", width: 840, height: 280 },
  Topology: () => (
    <>
      <Cable a="FIN-PC2:eth0" b="AUS-EDGE:Ethernet0/0" />
      <Cable a="AUS-EDGE:Ethernet0/1" b="DC-GW:Ethernet0/0" />
      <Cable a="DC-GW:Ethernet0/1" b="ERP-APP:eth0" />
      <VPC id="FIN-PC2" label="FIN-PC2" x={60} y={110} init={(d) => hostIp(d, "10.90.10.50", M24, "10.90.10.1")} />
      <Router id="AUS-EDGE" label="AUS-EDGE" x={290} y={110} init={(d) => {
        setIf(d, "Ethernet0/0", "10.90.10.1", M24);
        setIf(d, "Ethernet0/1", "10.90.1.1", M30);
        addRoute(d, "10.90.99.0", M24, "10.90.1.2");
      }} />
      <Router id="DC-GW" label="DC-GW" x={520} y={110} init={(d) => {
        setIf(d, "Ethernet0/0", "10.90.1.2", M30);
        setIf(d, "Ethernet0/1", "10.90.99.1", M24);
        // ← the fault: no route back to the Finance subnet 10.90.10.0/24
      }} />
      <VPC id="ERP-APP" label="ERP-APP" x={750} y={110} init={(d) => hostIp(d, "10.90.99.10", M24, "10.90.99.1")} />
    </>
  ),
  checks: [
    { id: "gw", label: "Confirm the Finance PC can reach its own gateway", test: (s) => reaches(s, "FIN-PC2", "10.90.10.1") },
    { id: "back", label: "Verify the data-center router has a route back to Finance", test: (s) => hasRoute(s, "DC-GW", "10.90.10.0", 24, "10.90.1.1") },
    { id: "erp", label: "Confirm the Finance PC can reach the ERP server", test: (s) => reaches(s, "FIN-PC2", "10.90.99.10") },
  ],
  suggested: [{ where: "Finance PC", commands: ["ping 10.90.99.10", "trace 10.90.99.10"] }, { where: "Routers", commands: ["show ip route"] }],
  hints: [
    "The ping times out instead of saying 'unreachable'. That usually means the request arrives but the reply can't get back.",
    "Trace the return path: does DC-GW know how to reach 10.90.10.0/24? Check `show ip route` there.",
    "On DC-GW: `ip route 10.90.10.0 255.255.255.0 10.90.1.1`.",
  ],
  xp: 150,
};

export const printerGateway: Scenario = {
  id: "printer-gateway",
  title: "Printer can't answer off-subnet",
  canvas: { title: "Meeting room printer", width: 840, height: 280 },
  Topology: () => (
    <>
      <Cable a="SALES-PC2:eth0" b="MR-GW:Ethernet0/0" />
      <Cable a="MR-GW:Ethernet0/1" b="MR-PRN:eth0" />
      <VPC id="SALES-PC2" label="SALES-PC2" x={90} y={110} init={(d) => hostIp(d, "10.20.30.50", M24, "10.20.30.1")} />
      <Router id="MR-GW" label="MR-GW" x={420} y={110} init={(d) => {
        setIf(d, "Ethernet0/0", "10.20.30.1", M24);
        setIf(d, "Ethernet0/1", "10.20.50.1", M24);
      }} />
      <VPC id="MR-PRN" label="MR-PRN" x={750} y={110} init={(d) => hostIp(d, "10.20.50.20", M24, "10.20.50.254" /* ← the fault: should be .1 */)} />
    </>
  ),
  checks: [
    { id: "local", label: "Confirm the printer answers on its own subnet", test: (s) => reaches(s, "MR-GW", "10.20.50.20") },
    { id: "gw", label: "Verify the printer's configured default gateway", test: (s) => s.devs["MR-PRN"]?.gw === "10.20.50.1" },
    { id: "pc", label: "Confirm users can reach the printer from their subnet", test: (s) => reaches(s, "SALES-PC2", "10.20.50.20") },
  ],
  suggested: [{ where: "Sales PC", commands: ["ping 10.20.50.20"] }, { where: "Printer", commands: ["show ip"] }, { where: "Router", commands: ["ping 10.20.50.20"] }],
  hints: [
    "The router can ping the printer, but users on another subnet time out. Who needs to send the reply?",
    "The printer answers via its default gateway. Check it with `show ip` on the printer.",
    "Reconfigure the printer: `ip 10.20.50.20/24 10.20.50.1`.",
  ],
  xp: 100,
};