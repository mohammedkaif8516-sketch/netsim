"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Building2, ChevronRight, Clock3, Globe2, MapPin, Network, RadioTower } from "lucide-react";
import { tickets, type Ticket } from "@/lib/data/tickets";
import { placeOf, world } from "@/lib/data/world";
import { fmtSla } from "@/lib/state/format";
import { secondsLeft, useGame } from "@/lib/state/game-store";
import { snapshot } from "@/lib/state/health";
import type { Store } from "@/lib/engine/netsim";
import type { Scenario } from "@/lib/scenarios/types";
import { TopologyView } from "./ui/topology-view";

type Path = { country?: string; city?: string; building?: string; dept?: string };
type Level = "world" | "country" | "city" | "building" | "department";
const BUILDING_POS = [{ x: 47, y: 54 }, { x: 19, y: 27 }, { x: 74, y: 28 }];

/** Everything here is derived from data/world.ts and the live ticket state. Nothing is hardcoded to one city. */
interface WorldMapProps {
  ticket: Ticket;
  onOpenTicket: (t: Ticket) => void;
  /** the selected ticket's live lab, for the Topology view */
  store: Store;
  scenario?: Scenario;
  results: boolean[];
}
export function WorldMap({ ticket, onOpenTicket, store, scenario, results }: WorldMapProps) {
  const { resolved, now, deadlines, mapMode, setMapMode } = useGame();
  const [path, setPath] = useState<Path>({});

  // when a ticket is picked from the queue, move the map to its building
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const p = placeOf(ticket.deptId);
    setPath({ country: p.country.id, city: p.city.id, building: p.building.id });
  }, [ticket.id, ticket.deptId]);

  const country = world.find((c) => c.id === path.country);
  const city = country?.cities.find((c) => c.id === path.city);
  const building = city?.buildings.find((b) => b.id === path.building);
  const dept = building?.departments.find((d) => d.id === path.dept);
  const level: Level = dept ? "department" : building ? "building" : city ? "city" : country ? "country" : "world";

  const openIn = (pred: (t: Ticket) => boolean) => tickets.filter((t) => !resolved[t.id] && pred(t)).length;
  const openCountry = (id: string) => openIn((t) => placeOf(t.deptId).country.id === id);
  const openCity = (id: string) => openIn((t) => placeOf(t.deptId).city.id === id);
  const openBuilding = (id: string) => openIn((t) => placeOf(t.deptId).building.id === id);
  const openDept = (id: string) => openIn((t) => t.deptId === id);
  const worldOpen = openIn(() => true);
  const health = snapshot(resolved);

  const crumbs: { label: string; to: Path }[] = [{ label: "World", to: {} }];
  if (country) crumbs.push({ label: country.name, to: { country: country.id } });
  if (city) crumbs.push({ label: city.name, to: { country: country!.id, city: city.id } });
  if (building) crumbs.push({ label: building.name, to: { country: country!.id, city: city!.id, building: building.id } });
  if (dept) crumbs.push({ label: dept.name, to: path });
  const up = () => setPath(crumbs[Math.max(crumbs.length - 2, 0)].to);

  const title = dept?.name ?? building?.name ?? (city ? `${country!.name} / ${city.name}` : country?.name ?? "Operations world");
  const deptTickets = dept ? tickets.filter((t) => t.deptId === dept.id) : [];

  return (
    <section className="map-panel" aria-label="Network operations world map">
      <div className="map-header">
        <div>
          <p className="eyebrow">GLOBAL NETWORK · <span className="live-label"><i /> LIVE</span></p>
          <h1>{mapMode === "topology" ? "Network topology" : title}</h1>
          <p className="map-subtitle">{mapMode === "topology" ? `${ticket.id} · ${placeOf(ticket.deptId).dept.name}. Live state of the affected network.` : level === "world" ? "Select an active region to investigate its network." : "Drill down to the affected team and open the network lab."}</p>
        </div>
        <div className="map-view-toggle"><button className={`view-button ${mapMode === "map" ? "selected" : ""}`} onClick={() => setMapMode("map")} aria-pressed={mapMode === "map"}><Globe2 /> Map</button><button className={`view-button ${mapMode === "topology" ? "selected" : ""}`} onClick={() => setMapMode("topology")} aria-pressed={mapMode === "topology"}><Network /> Topology</button></div>
      </div>

      {mapMode === "topology" ? (
        <TopologyView store={store} ticketId={ticket.id} scenario={scenario} results={results} />
      ) : (
        <>
      <nav className="breadcrumbs" aria-label="Map breadcrumbs">
        {level !== "world" && <button className="back-button" onClick={up} aria-label="Go back"><ArrowLeft /></button>}
        {crumbs.map((c, i) => (
          <span className="crumb-wrap" key={c.label}>
            <button className={i === crumbs.length - 1 ? "current" : ""} onClick={() => setPath(c.to)}>{c.label}</button>
            {i < crumbs.length - 1 && <ChevronRight />}
          </span>
        ))}
        {level === "world" && <span className="crumb-hint">{world.length} regions online <span className="status-dot" /></span>}
      </nav>

      <div className={`map-stage map-level-${level}`}>
        <div className="map-grid" />
        <svg className="route-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="routeGlow"><stop stopColor="#32d8bf" stopOpacity=".14" /><stop offset=".5" stopColor="#32d8bf" stopOpacity=".65" /><stop offset="1" stopColor="#32d8bf" stopOpacity=".1" /></linearGradient></defs>
          <path d="M250 234 C360 160 420 210 530 174 S640 280 670 330" /><path d="M250 234 C390 300 470 380 670 330" /><path d="M530 174 C570 220 618 270 670 330" />
          <path className="route-dash" d="M250 234 C360 160 420 210 530 174 S640 280 670 330" />
        </svg>

        {level === "world" && <>
          <div className="continent continent-americas" /><div className="continent continent-europe" /><div className="continent continent-africa" /><div className="continent continent-asia" /><div className="continent continent-oceania" />
          {world.map((c) => {
            const n = openCountry(c.id);
            return (
              <button key={c.id} className={`map-node node-${c.tone}`} style={{ left: `${c.x}%`, top: `${c.y}%` }} onClick={() => setPath({ country: c.id })} aria-label={`${c.name}, ${n} open tickets`}>
                <span className="node-ring"><span /></span><span className="node-label"><b>{c.cities[0].name}</b><small>{c.name}</small></span>{n > 0 && <span className="node-count">{n}</span>}
              </button>
            );
          })}
          <div className="map-caption"><span className="legend-live" />Active site <span className="legend-ticket" />Open incident</div>
          <div className="map-callout"><span className="callout-icon"><RadioTower /></span><span><b>{worldOpen ? `${worldOpen} open incidents` : "Core network healthy"}</b><small>{health.sitesConnected} of {health.sitesTotal} sites reporting</small></span><span className="uptime">{health.availability.toFixed(2)}% <small>UPTIME</small></span></div>
        </>}

        {level === "country" && country && <>
          <div className="region-grid"><div className="region-shape" /><div className="region-shape second" /></div>
          {country.cities.map((c, i) => (
            <button key={c.id} className="city-marker" style={{ left: `${49 + i * 14}%`, top: `${47 - i * 8}%` }} onClick={() => setPath({ country: country.id, city: c.id })}>
              <span className="city-pulse" /><span className="city-label">{c.name}<small>{c.buildings.length} active site{c.buildings.length > 1 ? "s" : ""}</small></span>
              {openCity(c.id) > 0 && <span className="node-count">{openCity(c.id)}</span>}
            </button>
          ))}
          <div className="map-callout"><span className="callout-icon"><Globe2 /></span><span><b>{country.name} region</b><small>Regional backbone connected · {country.cities.length} {country.cities.length > 1 ? "cities" : "city"}</small></span><span className="uptime">{country.cities.reduce((a, c) => a + c.sites, 0)} <small>SITES</small></span></div>
        </>}

        {level === "city" && city && <>
          {city.buildings.map((b, i) => {
            const pos = BUILDING_POS[i % BUILDING_POS.length], n = openBuilding(b.id);
            return (
              <button key={b.id} className="building-marker" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} onClick={() => setPath({ ...path, building: b.id })}>
                <span className="building-icon"><Building2 /></span><span className="building-label"><b>{b.name}</b><small>{b.kind}</small></span>{n > 0 && <span className="node-count">{n}</span>}
              </button>
            );
          })}
          <div className="map-callout"><span className="callout-icon"><MapPin /></span><span><b>{city.name} metro</b><small>{city.buildings.length} corporate site · {city.buildings.reduce((a, b) => a + b.departments.length, 0)} departments</small></span><span className="uptime">{city.buildings.length} <small>BUILDINGS</small></span></div>
        </>}

        {level === "building" && building && <>
          <div className="building-floorplan">
            <div className="floor-label">{building.name}<span>· {building.kind}</span></div>
            <div className="department-grid">
              {building.departments.map((d) => {
                const n = openDept(d.id);
                return (
                  <button key={d.id} className={`department-room ${n ? "room-alert" : ""}`} onClick={() => setPath({ ...path, dept: d.id })}>
                    <span className="room-icon"><Network /></span>
                    <span><b>{d.name}</b><small>{d.devices} devices · {d.switches} switch{d.switches > 1 ? "es" : ""}{n ? ` · ${n} open` : ""}</small></span>
                    {n > 0 && <span className="room-alert-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="map-callout"><span className="callout-icon"><Building2 /></span><span><b>Building network</b><small>Access layer · {building.departments.length} departments connected</small></span><span className="uptime">{openBuilding(building.id)} <small>OPEN</small></span></div>
        </>}

        {level === "department" && dept && (
          <div className="department-focus">
            <div className="dept-tickets">
              {deptTickets.length === 0 && <p className="dept-empty">No incidents in {dept.name}.</p>}
              {deptTickets.map((t) => {
                const done = !!resolved[t.id], secs = secondsLeft(deadlines[t.id], now, t.slaSec);
                return (
                  <button key={t.id} className={`ticket-card ${done ? "is-resolved" : ""}`} onClick={() => onOpenTicket(t)}>
                    <div className="ticket-card-top"><span className={`priority-tag priority-${t.priority.toLowerCase()}`}><i />{t.priority}</span><span className="ticket-age">{t.id}</span></div>
                    <strong>{t.subject}</strong>
                    <span className="ticket-category">{t.category}</span>
                    <span className="ticket-sla"><Clock3 /> {done ? "Resolved" : `SLA ${fmtSla(secs)}`} <span className="priority-word">{t.scenarioId ? "Open lab" : "Lab not built"}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
        </>
      )}
      <div className="map-bottom"><span><span className="status-dot" /> {worldOpen ? `${worldOpen} incidents open` : "All systems operational"}</span><span>{mapMode === "topology" ? "Topology · live" : "Network map · updated just now"}</span></div>
    </section>
  );
}