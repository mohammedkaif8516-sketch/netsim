"use client";

/**
 * INC-2841 — HR laptops get no address.
 *
 * Injected fault: pool HR is configured for 10.10.30.0/24, but the gateway interface sits in 10.10.20.0/24.
 * A DHCP server only answers on an interface whose subnet matches a pool's `network`, so every DISCOVER is ignored.
 *
 * Fix:   ip dhcp pool HR  ->  network 10.10.20.0 255.255.255.0   then   ip dhcp   on both laptops.
 */
import Router from "@/components/simulator/Router";
import Switch from "@/components/simulator/Switch";
import VPC from "@/components/simulator/VPC";
import { Cable, netOf, probe, type State } from "@/components/simulator/netsim";
import type { Scenario } from "./types";

const GW = "HR-GW";
const GW_IF = "Ethernet0/0";
const GW_IP = "10.10.20.1";
const CLIENTS = ["HR-LT-204", "HR-LT-205"];

const hasLease = (s: State, id: string) => {
  const ip = s.devs[id]?.ifaces.eth0?.ip;
  return !!ip && !ip.startsWith("169.254");
};

function poolMatchesGateway(s: State) {
  const d = s.devs[GW];
  const i = d?.ifaces[GW_IF];
  if (!d?.dhcp || d.dhcp.off || !i?.ip) return false;
  return Object.values(d.dhcp.pools).some((p) => p.net && p.mask && netOf(i.ip!, p.mask) === p.net);
}

function Topology() {
  return (
    <>
      <Cable a={`${GW}:${GW_IF}`} b="HR-SW:Ethernet0/0" />
      <Cable a="HR-SW:Ethernet0/1" b="HR-LT-204:eth0" />
      <Cable a="HR-SW:Ethernet0/2" b="HR-LT-205:eth0" />
      <Router id={GW} label={GW} x={92} y={95} init={(d) => {
        const e = d.ifaces[GW_IF];
        e.ip = GW_IP; e.mask = "255.255.255.0"; e.shut = false;
        // ↓ the fault: wrong network in the pool
        d.dhcp = {
          pools: { HR: { net: "10.10.30.0", mask: "255.255.255.0", gw: [GW_IP], dns: ["10.10.1.53"] } },
          excluded: [{ from: "10.10.20.1", to: "10.10.20.10" }],
        };
      }} />
      <Switch id="HR-SW" label="HR-SW" x={320} y={95} />
      <VPC id="HR-LT-204" label="HR-LT-204" x={535} y={55} />
      <VPC id="HR-LT-205" label="HR-LT-205" x={535} y={165} />
    </>
  );
}

export const dhcpPool: Scenario = {
  id: "dhcp-pool",
  title: "DHCP connectivity",
  canvas: { title: "HR access network", width: 700, height: 330 },
  Topology,
  checks: [
    {
      id: "lease",
      label: "Check whether the client received a valid IP address",
      test: (s) => CLIENTS.every((c) => hasLease(s, c)),
    },
    {
      id: "pool",
      label: "Verify the DHCP service and pool configuration",
      test: poolMatchesGateway,
    },
    {
      id: "gateway",
      label: "Confirm the client can reach its default gateway",
      test: (s) => CLIENTS.every((c) => probe(s, c, GW_IP, []).kind === "reply"),
    },
  ],
  suggested: [
    { where: "Router", commands: ["show ip interface brief", "show ip dhcp pool"] },
    { where: "Workstation", commands: ["ip dhcp", "show ip"] },
  ],
  hints: [
    "The laptops ask for an address but nothing answers. Start on the router: is the DHCP server running?",
    "Compare the pool's range in `show ip dhcp pool` with the subnet on the router's interface.",
    "The pool's network must match the interface subnet. Fix it under `ip dhcp pool HR`, then run `ip dhcp` on each laptop.",
  ],
  xp: 120,
};
