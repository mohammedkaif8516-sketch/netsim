"use client";

import { useSyncExternalStore } from "react";
import { ifUp, maskLen, shortIf, type Dev, type State, type Store } from "@/lib/engine/netsim";
import type { Scenario } from "@/lib/scenarios/types";
import { useGame } from "@/lib/state/game-store";

const W = 104;
const GREEN = "#2dd4bf", RED = "#ff6b6b", AMBER = "#f5a623", DIM = "#8ea0b0";
const isPhys = (n: string) => !n.startsWith("Vlan") && !n.startsWith("Loopback");

/** the text lines shown under a device name */
function lines(s: State, d: Dev): string[] {
  if (d.kind === "vpc") {
    const i = d.ifaces.eth0;
    return [i?.ip ? `${i.ip}/${maskLen(i.mask!)}` : "no ip", ...(d.gw ? [`gw ${d.gw}`] : [])];
  }
  if (d.kind === "router") {
    const l = Object.entries(d.ifaces).filter(([n, i]) => i.ip && isPhys(n) && !i.shut).slice(0, 3).map(([n, i]) => `${shortIf(n)} ${i.ip}/${maskLen(i.mask!)}`);
    return l.length ? l : ["no addresses"];
  }
  const ports = Object.keys(d.ifaces).filter(isPhys);
  const up = ports.filter((p) => ifUp(s, d.id, p)).length;
  return [`${up}/${ports.length} ports up`, `${Object.keys(d.vlans).length + 1} VLANs`];
}
const KIND: Record<string, string> = { router: "ROUTER", switch: "SWITCH", vpc: "HOST" };

interface Props { store: Store; ticketId: string; scenario?: Scenario; results: boolean[] }

/** Read-only, live diagram of the selected ticket's network. It redraws after every console command. */
export function TopologyView({ store, ticketId, scenario, results }: Props) {
  const s = useSyncExternalStore(store.subscribe, store.get, store.get);
  const setView = useGame((g) => g.setView);
  const devs = Object.values(s.devs);

  if (!scenario) return <div className="topo-empty">No lab is attached to {ticketId} yet, so there is no topology to show.</div>;
  if (!devs.length) return <div className="topo-empty">Starting the lab…</div>;

  const height = (d: Dev) => 34 + 12 * lines(s, d).length;
  const pad = 80;
  const minX = Math.min(...devs.map((d) => d.x)) - pad - W / 2, maxX = Math.max(...devs.map((d) => d.x)) + pad + W / 2;
  const minY = Math.min(...devs.map((d) => d.y)) - pad, maxY = Math.max(...devs.map((d) => d.y)) + pad + 20;
  const passed = results.filter(Boolean).length;
  const open = () => setView("lab");

  const along = (a: Dev, b: Dev, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  return (
    <div className="topo-wrap">
      <div className="topo-bar">
        <span><b>{scenario.canvas.title}</b> · live</span>
        <span className="topo-legend"><i style={{ background: GREEN }} />link up <i style={{ background: RED }} />link down <i style={{ background: AMBER }} />needs attention</span>
        <span className="topo-checks">{passed}/{results.length} checks</span>
        <button className="quiet-button" onClick={open}>Open lab →</button>
      </div>
      <svg className="topo-svg" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="img" aria-label={`Topology of ${scenario.canvas.title}`}>
        {s.links.map((l, i) => {
          const a = s.devs[l.a[0]], b = s.devs[l.b[0]];
          if (!a || !b) return null;
          const up = ifUp(s, a.id, l.a[1]) && ifUp(s, b.id, l.b[1]);
          const pa = along(a, b, 0.24), pb = along(a, b, 0.76), c = up ? GREEN : RED;
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c} strokeWidth={2} strokeDasharray={up ? undefined : "6 5"} opacity={up ? 0.8 : 1} />
              <text x={pa.x} y={pa.y - 5} textAnchor="middle" fontSize={10} fill={DIM} stroke="#0b121a" strokeWidth={3} paintOrder="stroke">{shortIf(l.a[1])}</text>
              <text x={pb.x} y={pb.y - 5} textAnchor="middle" fontSize={10} fill={DIM} stroke="#0b121a" strokeWidth={3} paintOrder="stroke">{shortIf(l.b[1])}</text>
            </g>
          );
        })}
        {devs.map((d) => {
          const h = height(d), t = lines(s, d);
          const shut = Object.entries(d.ifaces).some(([n, i]) => isPhys(n) && i.shut && s.links.some((l) => (l.a[0] === d.id && l.a[1] === n) || (l.b[0] === d.id && l.b[1] === n)));
          const noIp = d.kind === "vpc" && !d.ifaces.eth0?.ip;
          const color = shut || noIp ? AMBER : GREEN;
          return (
            <g key={d.id} role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={open} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") open(); }}>
              <rect x={d.x - W / 2} y={d.y - h / 2} width={W} height={h} rx={9} fill="#0f1822" stroke={color} strokeWidth={1.5} />
              <text x={d.x} y={d.y - h / 2 + 13} textAnchor="middle" fontSize={8} letterSpacing={1} fill={DIM}>{KIND[d.kind] ?? d.kind.toUpperCase()}</text>
              <text x={d.x} y={d.y - h / 2 + 27} textAnchor="middle" fontSize={11} fontWeight={700} fill="#e5edf5">{d.hostname}</text>
              {t.map((x, i) => <text key={i} x={d.x} y={d.y - h / 2 + 40 + i * 12} textAnchor="middle" fontSize={9} fill={x === "no ip" ? AMBER : DIM}>{x}</text>)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}