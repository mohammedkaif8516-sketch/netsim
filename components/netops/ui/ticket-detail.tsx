"use client";

import { ArrowRight, Bell, Check, Clock3, Menu, Settings2, ShieldCheck } from "lucide-react";
import type { Ticket } from "@/lib/data/tickets";
import { locationLabel, placeOf } from "@/lib/data/world";
import type { Scenario } from "@/lib/scenarios/types";
import { fmtAge, fmtSla } from "@/lib/state/format";
import { secondsLeft, useGame } from "@/lib/state/game-store";
import { Checklist } from "./checklist";

export function TicketDetail({ ticket, scenario, results }: { ticket: Ticket; scenario?: Scenario; results: boolean[] }) {
  const { now, deadlines, resolved, resolve, setView } = useGame();
  const place = placeOf(ticket.deptId);
  const done = !!resolved[ticket.id];
  const passed = results.filter(Boolean).length;
  const allPass = !!scenario && results.length > 0 && passed === results.length;
  const secs = secondsLeft(deadlines[ticket.id], now, ticket.slaSec);
  const urgent = ticket.priority === "P1" && !done;

  const why = !scenario ? "The lab for this ticket hasn't been built yet" : allPass ? "" : `${passed} of ${results.length} checks pass. Fix the network first`;

  return (
    <aside className="detail-panel" aria-label="Selected ticket details">
      <div className="detail-heading"><div><p className="eyebrow">TICKET DETAILS</p><span className="ticket-id">{ticket.id}</span></div><button className="icon-button" aria-label="More ticket options"><Menu /></button></div>
      <div className="detail-priority-row"><span className={`priority-tag priority-${ticket.priority.toLowerCase()}`}><i />{ticket.priority} PRIORITY</span><span className="status-open"><i />{done ? "Resolved" : "Open"}</span></div>
      <h2 className="detail-title">{ticket.subject}</h2>
      <p className="detail-description">{ticket.description}</p>
      <div className="reporter-row"><span className="reporter-avatar">{ticket.reporter.split(" ").map((n) => n[0]).join("")}</span><span><b>{ticket.reporter}</b><small>Reporter · {fmtAge(ticket.ageMin)}</small></span><button className="icon-button" aria-label="Message reporter"><Bell /></button></div>
      <div className="detail-divider" />
      <div className="detail-section-title"><span>INCIDENT OVERVIEW</span><button className="quiet-icon" aria-label="Edit incident"><Settings2 /></button></div>
      <dl className="incident-facts">
        <div><dt>Category</dt><dd>{ticket.category}</dd></div>
        <div><dt>Location</dt><dd>{locationLabel(place)}</dd></div>
        <div><dt>Department</dt><dd>{place.dept.name}</dd></div>
        <div><dt>Assigned to</dt><dd>{ticket.assignee === "me" ? <span className="assignee"><span>AS</span> Alex Sharma</span> : "Unassigned"}</dd></div>
      </dl>
      <div className="sla-box">
        <div><span className="sla-box-icon"><Clock3 /></span><span><b>{done ? "Resolved" : secs < 0 ? "SLA breached" : "Time to SLA breach"}</b><small>{ticket.priority === "P1" ? "Critical response target" : "Response target"}</small></span></div>
        {!done && <strong className={urgent || secs < 0 ? "urgent-time" : ""}>{fmtSla(secs)}</strong>}
      </div>
      <Checklist checks={scenario?.checks} results={results} />
      <div className="detail-actions">
        <button className="primary-action" onClick={() => setView("lab")}>Investigate ticket <ArrowRight /></button>
        <button className="resolve-action" disabled={done || !allPass} title={done ? "Already resolved" : why}
          onClick={() => scenario && resolve(ticket.id, scenario.xp)}><Check /> {done ? "Resolved" : "Mark resolved"}</button>
      </div>
      <div className="detail-footnote"><ShieldCheck /> {done ? "Closed. XP has been awarded." : why || "All checks pass. You can resolve this ticket."}</div>
    </aside>
  );
}
