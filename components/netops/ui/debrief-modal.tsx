"use client";

import { useEffect } from "react";
import { ArrowRight, Lightbulb, X } from "lucide-react";
import { ticketById } from "@/lib/data/tickets";
import { locationLabel, placeOf } from "@/lib/data/world";
import { knowledge } from "@/lib/data/knowledge";
import { debriefs } from "@/lib/scenarios/debriefs";
import { scenarioFor } from "@/lib/scenarios";
import { useGame } from "@/lib/state/game-store";
import { classify } from "@/lib/state/scoring";
import { recommendNext } from "@/lib/state/career";
import { fmtClock, fmtSla } from "@/lib/state/format";

const VERDICT = { 3: "Flawless", 2: "Solid", 1: "Resolved" } as const;
const Stars = ({ n }: { n: number }) => <span className="db-stars" aria-label={`${n} of 3 stars`}>{"★".repeat(n)}<i>{"★".repeat(3 - n)}</i></span>;

/** Opens automatically when you resolve a ticket (and from the Logbook / "Review debrief"). */
export function DebriefModal() {
  const { debriefId, closeDebrief, reports, resolved, select, setView } = useGame();
  useEffect(() => {
    if (!debriefId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDebrief(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [debriefId, closeDebrief]);

  const ticket = debriefId ? ticketById(debriefId) : undefined;
  const report = debriefId ? reports[debriefId] : undefined;
  if (!debriefId || !ticket || !report) return null;

  const place = placeOf(ticket.deptId);
  const sc = scenarioFor(ticket);
  const db = sc ? debriefs[sc.id] : undefined;
  const next = recommendNext(resolved);

  // how the player worked
  const ev = report.events;
  const shown = ev.filter((e) => classify(e.line) !== "mode");
  const kinds = shown.map((e) => classify(e.line));
  const inspections = kinds.filter((k) => k === "inspect").length, changes = kinds.filter((k) => k === "change").length;
  const firstChange = kinds.indexOf("change");
  const inspectedFirst = firstChange === -1 ? inspections : kinds.slice(0, firstChange).filter((k) => k === "inspect").length;
  const refChanges = db ? db.solution.reduce((a, s) => a + s.commands.filter((c) => classify(c) === "change").length, 0) : 0;
  const t0 = ev[0]?.t ?? 0;
  const rel = (t: number) => fmtSla(Math.max(0, Math.round((t - t0) / 1000)));

  const insights: string[] = [];
  if (changes > 0) {
    if (inspectedFirst === 0) insights.push("You changed something before looking at anything. `show` commands are free, so gather evidence first.");
    else if (inspectedFirst >= 3) insights.push(`Good method: ${inspectedFirst} inspections before your first change.`);
    else insights.push(`You made ${inspectedFirst} inspection${inspectedFirst === 1 ? "" : "s"} before your first change.`);
    if (refChanges && changes > refChanges * 2) insights.push(`You made ${changes} changes where the reference fix needs ${refChanges}. Fewer, evidence-driven changes are faster and safer.`);
    else if (refChanges && changes <= refChanges + 1) insights.push(`Precise: ${changes} change${changes === 1 ? "" : "s"} against ${refChanges} in the reference fix.`);
  }
  if (report.resets > 0) insights.push(`You reset the lab ${report.resets} time${report.resets === 1 ? "" : "s"}.`);

  const x = report.xp;
  const cleanLabel = report.hints === 0 ? "No-hint bonus" : report.hints === 1 ? "One-hint bonus" : "Hints used";
  const review = (db?.review ?? []).map((id) => knowledge.find((k) => k.id === id)).filter(Boolean) as typeof knowledge;

  return (
    <>
      <div className="kb-backdrop" onClick={closeDebrief} />
      <section className="debrief" role="dialog" aria-label={`Incident debrief ${ticket.id}`}>
        <header className="db-head">
          <div>
            <p className="eyebrow">INCIDENT DEBRIEF · {ticket.id}</p>
            <h2>{ticket.subject}</h2>
            <small>{locationLabel(place)} · {place.dept.name} · {ticket.category}</small>
          </div>
          <button className="icon-button" onClick={closeDebrief} aria-label="Close debrief"><X /></button>
        </header>

        <div className="db-body">
          <div className="db-result">
            <div><Stars n={report.stars} /><b>{VERDICT[report.stars]}</b></div>
            <dl>
              <div><dt>Time</dt><dd>{report.durationSec ? fmtSla(report.durationSec) : "—"}</dd></div>
              <div><dt>SLA</dt><dd className={report.late ? "bad" : "good"}>{report.late ? "Missed" : "Met"}</dd></div>
              <div><dt>Hints</dt><dd>{report.hints}</dd></div>
              <div><dt>Commands</dt><dd>{shown.length}</dd></div>
            </dl>
          </div>

          <div className="db-xp" aria-label="XP breakdown">
            <span>Base <b>+{x.base}</b></span>
            <span>Within SLA <b>{x.sla ? `+${x.sla}` : "+0"}</b></span>
            <span>{cleanLabel} <b>{x.clean ? `+${x.clean}` : "+0"}</b></span>
            <span className="db-xp-total">Total <b>+{x.total} XP</b></span>
          </div>

          {db ? (
            <>
              <h3>What was wrong</h3>
              <p className="db-cause">{db.rootCause}</p>
              <p>{db.explanation}</p>
            </>
          ) : <p>No write-up exists for this scenario yet.</p>}

          <h3>How you worked</h3>
          {insights.map((t, i) => <p key={i} className="db-insight">{t}</p>)}
          {shown.length === 0 ? <p className="db-muted">No console commands were recorded for this ticket.</p> : (
            <ol className="db-timeline">
              {shown.slice(0, 40).map((e, i) => (
                <li key={i}><span className="db-t">+{rel(e.t)}</span><span className="db-dev">{e.dev}</span><code>{e.line}</code><i className={`db-chip ${kinds[i]}`}>{kinds[i]}</i></li>
              ))}
              {shown.length > 40 && <li className="db-muted">…and {shown.length - 40} more</li>}
            </ol>
          )}
          <p className="db-muted">Mode changes such as <code>enable</code> and <code>end</code> are hidden. {fmtClock(report.at)}</p>

          {db && (
            <>
              <h3>Reference fix</h3>
              {db.solution.map((s) => (
                <div key={s.device} className="db-solution"><b>{s.device}</b><pre>{s.commands.join("\n")}</pre></div>
              ))}
              <h3><Lightbulb size={13} /> Remember</h3>
              <p className="db-lesson">{db.lesson}</p>
              <div className="db-review">
                {review.map((k) => <div key={k.id}><code>{k.example}</code><span>{k.what}</span></div>)}
              </div>
            </>
          )}
        </div>

        <footer className="db-foot">
          <button className="quiet-button" onClick={closeDebrief}>Close</button>
          {next ? (
            <button className="primary-action" onClick={() => { select(next.id); setView("lab"); closeDebrief(); }}>
              Next up: {next.id} · {next.subject} <ArrowRight />
            </button>
          ) : <span className="db-muted">Every ticket is resolved. Check your Logbook.</span>}
        </footer>
      </section>
    </>
  );
}