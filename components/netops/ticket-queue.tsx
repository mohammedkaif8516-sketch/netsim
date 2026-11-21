"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowDownUp, Clock3, MapPin, Search, ShieldAlert, X } from "lucide-react";
import { tickets, priorityLabel, type Ticket } from "@/lib/data/tickets";
import { locationLabel, placeOf } from "@/lib/data/world";
import { fmtAge, fmtSla } from "@/lib/state/format";
import { secondsLeft, useGame, type Filter, type Sort } from "@/lib/state/game-store";

const SORTS: Sort[] = ["sla", "priority", "age"];
const SORT_LABEL: Record<Sort, string> = { sla: "SLA (soonest first)", priority: "priority", age: "newest first" };

/** words a ticket can be found by: id, priority, subject, category, reporter, place, description, status */
function haystack(t: Ticket, done: boolean) {
  const p = placeOf(t.deptId);
  return [t.id, t.priority, priorityLabel[t.priority], t.subject, t.category, t.reporter, t.description, p.city.name, p.country.name, p.dept.name, done ? "resolved closed" : "open", t.assignee === "me" ? "mine" : ""].join(" ").toLowerCase();
}

export function TicketQueue() {
  const { selectedId, select, query, setQuery, filter, setFilter, sort, setSort, now, deadlines, resolved } = useGame();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const left = (t: Ticket) => secondsLeft(deadlines[t.id], now, t.slaSec);

  const visible = useMemo(() => {
    // every word you type must match somewhere: "bengaluru p1", "vlan warehouse", "resolved"
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const found = tickets.filter((t) => {
      const done = !!resolved[t.id];
      if (filter === "mine" && t.assignee !== "me") return false;
      if (filter === "resolved" && !done) return false;
      if (!words.length) return true;
      const hay = haystack(t, done);
      return words.every((w) => hay.includes(w));
    });
    const secs = (t: Ticket) => secondsLeft(deadlines[t.id], now, t.slaSec);
    return found.sort((a, b) => {
      const ra = resolved[a.id] ? 1 : 0, rb = resolved[b.id] ? 1 : 0;
      if (ra !== rb) return ra - rb; // resolved sink to the bottom
      if (sort === "priority") return a.priority.localeCompare(b.priority) || secs(a) - secs(b);
      if (sort === "age") return a.ageMin - b.ageMin;
      return secs(a) - secs(b);
    });
  }, [query, filter, sort, now, deadlines, resolved]);

  // keep the selected ticket in view when it changes from somewhere else (e.g. the map)
  useEffect(() => { list.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest" }); }, [selectedId]);

  const mine = tickets.filter((t) => t.assignee === "me").length;
  const doneCount = Object.keys(resolved).length;
  const open = tickets.length - doneCount;
  const chip = (f: Filter, label: string, n: number) => (
    <button className={`filter-chip ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>{label} <span>{n}</span></button>
  );

  return (
    <aside className="queue-panel" aria-label="Ticket queue">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">LIVE INCIDENTS</p>
          <h2>Ticket queue <span className="count-pill">{String(open).padStart(2, "0")}</span></h2>
        </div>
        <button className="icon-button" aria-label="Search tickets" onClick={() => input.current?.focus()}><Search /></button>
      </div>
      <div className="queue-searchbar">
        <Search size={13} aria-hidden="true" />
        <input ref={input} type="search" value={query} placeholder="Search id, subject, city, department…" aria-label="Search tickets"
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }} />
        {query && <button className="queue-clear" aria-label="Clear search" onClick={() => { setQuery(""); input.current?.focus(); }}><X size={12} /></button>}
      </div>
      <div className="queue-controls">
        {chip("all", "All", tickets.length)}
        {chip("mine", "My tickets", mine)}
        {chip("resolved", "Resolved", doneCount)}
        <button className="icon-button" aria-label={`Sorted by ${SORT_LABEL[sort]}. Click to change`} title={`Sorted by ${SORT_LABEL[sort]}`}
          onClick={() => setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length])}><ArrowDownUp /></button>
      </div>
      {(query || filter !== "all") && <div className="queue-count" role="status">{visible.length} of {tickets.length} tickets{query && <> match &ldquo;{query}&rdquo;</>}</div>}
      <div className="queue-list" ref={list}>
        {visible.length === 0 && (
          <div className="queue-empty">
            <b>No tickets found</b>
            <span>{filter === "resolved" && !query ? "Nothing resolved yet. Fix a lab and it will show up here." : "Try fewer words, or clear the filters."}</span>
            {(query || filter !== "all") && <button className="quiet-button" onClick={() => { setQuery(""); setFilter("all"); }}>Clear search and filters</button>}
          </div>
        )}
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