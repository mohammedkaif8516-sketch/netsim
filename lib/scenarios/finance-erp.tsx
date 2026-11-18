"use client";

/**
 * INC-2838 — Finance cannot reach ERP.
 *
 * Injected fault: The Finance router has no static route to the Data Center subnet,
 * and the Data Center router has no route back to the Finance subnet.
 * Finance PCs can reach their local gateway, but traffic to the ERP server (192.168.50.10) drops.
 *
 * Fix:   On FIN-GW:  ip route 192.168.50.0 255.255.255.0 10.10.1.2
 *        On DC-GW:   ip route 10.10.10.0 255.255.255.0 10.10.1.1
 */
import Router from "@/lib/engine/Router";
import Switch from "@/lib/engine/Switch";
import VPC from "@/lib/engine/VPC";
import { Cable, probe, type State, submit } from "@/lib/engine/netsim";
import type { Scenario } from "./types";

const FIN_GW = "FIN-GW";
const DC_GW = "DC-GW";
const FIN_PC = "FIN-PC-01";
const ERP_SRV = "ERP-SRV";

// The IP of the shared WAN link between the two routers
const WAN_FIN_IP = "10.10.1.1";
const WAN_DC_IP = "10.10.1.2";

function pingFromFinToErp(s: State) {
  // Use the simulator's probe function to check reachability
  return probe(s, FIN_PC, "192.168.50.10", []).kind === "reply";
}

function Topology() {
  return (
    <>
      {/* Finance LAN */}
      <Cable a={`${FIN_GW}:Ethernet0/0`} b="FIN-SW:Ethernet0/0" />
      <Cable a="FIN-SW:Ethernet0/1" b={`${FIN_PC}:eth0`} />
      
      {/* Data Center LAN */}
      <Cable a={`${DC_GW}:Ethernet0/0`} b="DC-SW:Ethernet0/0" />
      <Cable a="DC-SW:Ethernet0/1" b={`${ERP_SRV}:eth0`} />

      {/* WAN Link (Router to Router) */}
      <Cable a={`${FIN_GW}:Ethernet0/1`} b={`${DC_GW}:Ethernet0/1`} />

      {/* Finance Router */}
      <Router id={FIN_GW} label={FIN_GW} x={150} y={165} init={(d) => {
        // LAN Interface
        d.ifaces["Ethernet0/0"].ip = "10.10.10.1"; 
        d.ifaces["Ethernet0/0"].mask = "255.255.255.0"; 
        d.ifaces["Ethernet0/0"].shut = false;
        
        // WAN Interface
        d.ifaces["Ethernet0/1"].ip = WAN_FIN_IP; 
        d.ifaces["Ethernet0/1"].mask = "255.255.255.252"; 
        d.ifaces["Ethernet0/1"].shut = false;
        
        // THE FAULT: Missing static route to DC subnet
        // d.routes = [{ net: "192.168.50.0", mask: "255.255.255.0", via: WAN_DC_IP }];
      }} />
      <Switch id="FIN-SW" label="FIN-SW" x={150} y={280} />
      <VPC id={FIN_PC} label={FIN_PC} x={150} y={380} init={(d) => {
        d.ifaces.eth0.ip = "10.10.10.50"; 
        d.ifaces.eth0.mask = "255.255.255.0"; 
        d.gw = "10.10.10.1";
      }} />

      {/* Data Center Router */}
      <Router id={DC_GW} label={DC_GW} x={450} y={165} init={(d) => {
        // LAN Interface
        d.ifaces["Ethernet0/0"].ip = "192.168.50.1"; 
        d.ifaces["Ethernet0/0"].mask = "255.255.255.0"; 
        d.ifaces["Ethernet0/0"].shut = false;
        
        // WAN Interface
        d.ifaces["Ethernet0/1"].ip = WAN_DC_IP; 
        d.ifaces["Ethernet0/1"].mask = "255.255.255.252"; 
        d.ifaces["Ethernet0/1"].shut = false;

        // THE FAULT: Missing static route back to Finance subnet
      }} />
      <Switch id="DC-SW" label="DC-SW" x={450} y={280} />
      <VPC id={ERP_SRV} label={ERP_SRV} x={450} y={380} init={(d) => {
        d.ifaces.eth0.ip = "192.168.50.10"; 
        d.ifaces.eth0.mask = "255.255.255.0"; 
        d.gw = "192.168.50.1";
      }} />
    </>
  );
}

export const financeErp: Scenario = {
  id: "finance-erp",
  title: "Routing to Data Center",
  canvas: { title: "Finance to Data Center", width: 700, height: 450 },
  Topology,
  checks: [
    {
      id: "forward",
      label: "Verify the Finance router has a route to the ERP server",
      test: (s) => {
        // We can check the route table directly
        const r = s.devs[FIN_GW];
        // If it has a static route (t: "S"), it should point to the DC gateway
        return r?.routes?.some(x => x.net === "192.168.50.0" && x.via === WAN_DC_IP) ?? false;
      },
    },
    {
      id: "reverse",
      label: "Verify the Data Center router has a route back to Finance",
      test: (s) => {
        const r = s.devs[DC_GW];
        return r?.routes?.some(x => x.net === "10.10.10.0" && x.via === WAN_FIN_IP) ?? false;
      },
    },
    {
      id: "ping",
      label: "Confirm the Finance PC can reach the ERP server",
      test: pingFromFinToErp,
    }
  ],
  suggested: [
    { where: "Finance PC", commands: ["ping 192.168.50.10"] },
    { where: "Finance Router", commands: ["show ip route"] },
    { where: "DC Router", commands: ["show ip route"] },
  ],
  hints: [
    "The Finance PC can reach its local gateway but cannot reach the ERP server. The routers might not know how to find each other's networks.",
    "Check the routing tables on both routers (`show ip route`). You should see that neither router knows about the other's LAN subnet.",
    "On FIN-GW, add: `ip route 192.168.50.0 255.255.255.0 10.10.1.2`. On DC-GW, add: `ip route 10.10.10.0 255.255.255.0 10.10.1.1`.",
  ],
  xp: 150,
};