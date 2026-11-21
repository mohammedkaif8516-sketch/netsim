"use client";
/** Shared building block for the DHCP tickets: gateway ── switch ── two clients (+ optional server behind the gateway). */
import type { ReactNode } from "react";
import Router from "@/lib/engine/Router";
import Switch from "@/lib/engine/Switch";
import VPC from "@/lib/engine/VPC";
import { Cable, type Dev } from "@/lib/engine/netsim";
import { M24, setIf, hostIp } from "./helpers";

export interface DhcpLanProps {
  gw: string; sw: string; clients: [string, string];
  /** gateway's LAN address (/24) */
  lanIp: string;
  /** configure DHCP on the gateway, including the injected fault */
  setupGw: (d: Dev) => void;
  /** optional server on Ethernet0/1 of the gateway, in its own /24 */
  server?: { id: string; ip: string; gwIp: string };
  /** optional per-client preset (e.g. a stale lease) */
  initClient?: (id: string, d: Dev) => void;
  /** more devices on the switch (their cables and nodes) */
  extra?: ReactNode;
  height?: number;
}
export const DHCP_CANVAS = (title: string, server = false) => ({ title, width: 700, height: server ? 360 : 330 });

export function DhcpLan({ gw, sw, clients, lanIp, setupGw, server, initClient, extra }: DhcpLanProps) {
  return (
    <>
      <Cable a={`${gw}:Ethernet0/0`} b={`${sw}:Ethernet0/0`} />
      <Cable a={`${sw}:Ethernet0/1`} b={`${clients[0]}:eth0`} />
      <Cable a={`${sw}:Ethernet0/2`} b={`${clients[1]}:eth0`} />
      {server && <Cable a={`${gw}:Ethernet0/1`} b={`${server.id}:eth0`} />}
      <Router id={gw} label={gw} x={92} y={95} init={(d) => {
        setIf(d, "Ethernet0/0", lanIp, M24);
        if (server) setIf(d, "Ethernet0/1", server.gwIp, M24);
        setupGw(d);
      }} />
      <Switch id={sw} label={sw} x={320} y={95} />
      <VPC id={clients[0]} label={clients[0]} x={535} y={55} init={(d) => initClient?.(clients[0], d)} />
      <VPC id={clients[1]} label={clients[1]} x={535} y={165} init={(d) => initClient?.(clients[1], d)} />
      {server && <VPC id={server.id} label={server.id} x={92} y={260} init={(d) => hostIp(d, server.ip, M24, server.gwIp)} />}
      {extra}
    </>
  );
}