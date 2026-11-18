"use client";

import { useState } from "react";
import { NetLab, type Store } from "@/lib/engine/netsim";
import type { Ticket } from "@/lib/data/tickets";
import { placeOf } from "@/lib/data/world";
import type { Scenario } from "@/lib/scenarios/types";

interface Props {
  ticket: Ticket;
  scenario?: Scenario;
  store: Store;
  passed: number;
  total: number;
  onBack: () => void;
}

/** Renders whatever scenario the ticket points at. Remount with key={ticket.id} to reset the lab. */
export function NetworkLab({ ticket, scenario, store, passed, total, onBack }: Props) {
  const [hints, setHints] = useState(0);
  const place = placeOf(ticket.deptId);

  return (
    <section className="lab-panel" aria-label="Department network lab">
      <div className="lab-heading">
        <button className="quiet-button" onClick={onBack}>← Back to map</button>
        <span className="live-label"><i /> {scenario ? "SIMULATION READY" : "NO SCENARIO"}</span>
      </div>
      <div className="lab-summary">
        <div>
          <p className="eyebrow">DEPARTMENT NETWORK LAB · {ticket.id}</p>
          <h2>{place.dept.name} · {scenario?.title ?? ticket.category}</h2>
          <p>{scenario ? `${passed} of ${total} checks passing. Open device consoles and troubleshoot.` : "This ticket has no lab yet."}</p>
        </div>
        <span className={`priority-tag priority-${ticket.priority.toLowerCase()}`}><i />{ticket.priority} INCIDENT</span>
      </div>

      {!scenario ? (
        <div className="lab-empty">
          <b>Lab not built yet</b>
          <span>Add <code>scenarios/&lt;id&gt;.tsx</code> and set <code>scenarioId</code> on {ticket.id} in <code>data/tickets.ts</code>.</span>
        </div>
      ) : (
        <>
          <div className="lab-instructions">
            <b>Suggested checks</b>
            {scenario.suggested.map((s) => (
              <span key={s.where}>{s.where}: {s.commands.map((c, i) => <span key={c}>{i > 0 && " · "}<code>{c}</code></span>)}</span>
            ))}
          </div>
          <div className="lab-hints">
            {scenario.hints.slice(0, hints).map((h, i) => <span key={i}>Hint {i + 1}: {h}</span>)}
            {hints < scenario.hints.length && <button className="quiet-button" onClick={() => setHints(hints + 1)}>{hints ? "Another hint" : "Need a hint?"}</button>}
          </div>
          <div className="simulator-frame">
            <NetLab title={scenario.canvas.title} width={scenario.canvas.width} height={scenario.canvas.height} store={store}>
              <scenario.Topology />
            </NetLab>
          </div>
        </>
      )}
      <div className="lab-status-row"><span><span className="status-dot" /> Local simulator · changes are in-memory</span><span>Click a device to open its CLI</span></div>
    </section>
  );
}
