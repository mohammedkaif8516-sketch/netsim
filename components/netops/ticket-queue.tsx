"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, Clock3, MapPin, Search, ShieldAlert } from "lucide-react";
import { tickets, priorityLabel, type Ticket } from "@/lib/data/tickets";
import { locationLabel, placeOf } from "@/lib/data/world";
import { fmtAge, fmtSla } from "@/lib/state/format";
import { secondsLeft, useGame, type Sort } from "@/lib/state/game-store";

const SORTS: Sort[] = ["sla", "priority", "age"];
const SORT_LABEL: Record<Sort, string> = { sla: "SLA", priority: "priority", age: "newest" };

export function TicketQueue() {
  const { selectedId, select, query, setQuery, filter, setFilter, sort, setSort, now, deadlines, resolved } = useGame();
  const [searching, setSearching] = useState(false);

  const left = (t: Ticket) => secondsLeft(deadlines[t.id], now, t.slaSec);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = tickets.filter((t) => {
      if (filter === "mine" && t.assignee !== "me") return false;
      if (!q) return true;
      const p = placeOf(t.deptId);
      return [t.id, t.subject, t.category, t.reporter, p.city.name, p.dept.name].some((x) => x.toLowerCase().includes(q));
    });
    const secs = (t: Ticket) => secondsLeft(deadlines[t.id], now, t.slaSec);
    return list.sort((a, b) => {
      const ra = resolved[a.id] ? 1 : 0, rb = resolved[b.id] ? 1 : 0;
      if (ra !== rb) return ra - rb; // resolved sink to the bottom
      if (sort === "priority") return a.priority.localeCompare(b.priority) || secs(a) - secs(b);
      if (sort === "age") return a.ageMin - b.ageMin;
      return secs(a) - secs(b);
    });
  }, [query, filter, sort, now, deadlines, resolved]);

  const mine = tickets.filter((t) => t.assignee === "me").length;

  return (
    <aside className="queue-panel" aria-label="Ticket queue">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">LIVE INCIDENTS</p>
          <h2>Ticket queue <span className="count-pill">{String(tickets.length - Object.keys(resolved).length).padStart(2, "0")}</span></h2>
        </div>
        <button className="icon-button" aria-label="Search tickets" onClick={() => { setSearching(!searching); if (searching) setQuery(""); }}><Search /></button>
      </div>
      {searching && <input className="queue-search" autoFocus placeholder="Search id, subject, city, department…" value={query} onChange={(e) => setQuery(e.target.value)} />}
      <div className="queue-controls">
        <button className={`filter-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All <span>{tickets.length}</span></button>
        <button className={`filter-chip ${filter === "mine" ? "active" : ""}`} onClick={() => setFilter("mine")}>My tickets <span>{mine}</span></button>
        <button className="icon-button" aria-label={`Sorted by ${SORT_LABEL[sort]}. Click to change`} title={`Sorted by ${SORT_LABEL[sort]}`}
          onClick={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])}><ArrowDownUp /></button>
      </div>
      <div className="queue-list">
        {visible.length === 0 && <p className="dept-empty" style={{ padding: 16 }}>No tickets match.</p>}
        {visible.map((t) => {
          const secs = left(t), done = !!resolved[t.id], breached = !done && secs < 0;
          const p = placeOf(t.deptId);
          return (
            <button key={t.id} onClick={() => select(t.id)} aria-pressed={selectedId === t.id}
              className={`ticket-card ${selectedId === t.id ? "selected" : ""} ${done ? "is-resolved" : ""} ${breached ? "is-breached" : ""}`}>
              <div className="ticket-card-top">
                <span className={`priority-tag priority-${t.priority.toLowerCase()}`}><i />{t.priority}</span>
                <span className="ticket-age">{done ? "Resolved" : fmtAge(t.ageMin)}</span>
              </div>
              <strong>{t.subject}</strong>
              <span className="ticket-category">{t.category}</span>
              <span className="ticket-location"><MapPin />{locationLabel(p)} <span>·</span> {p.dept.name}</span>
              <span className={`ticket-sla ${t.priority === "P1" && !done ? "sla-urgent" : ""}`}>
                <Clock3 /> {done ? "Closed" : breached ? `SLA breached ${fmtSla(secs)}` : `SLA ${fmtSla(secs)}`} <span className="priority-word">{priorityLabel[t.priority]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="queue-footer"><ShieldAlert /> Tickets are simulated for this training session</div>
    </aside>
  );
}
