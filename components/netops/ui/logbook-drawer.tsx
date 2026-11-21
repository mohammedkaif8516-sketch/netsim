"use client";

import { useEffect } from "react";
import { ArrowRight, ClipboardList, X } from "lucide-react";
import { ticketById, tickets } from "@/lib/data/tickets";
import { careerStats, recommendNext, topicStats } from "@/lib/state/career";
import { fmtSla } from "@/lib/state/format";
import { levelInfo, resolvedTotal, useGame } from "@/lib/state/game-store";

const Stars = ({ n }: { n: number }) => <span className="db-stars">{"★".repeat(n)}<i>{"★".repeat(3 - n)}</i></span>;

/** Career view: totals, skill coverage, what to practise next, and every past debrief. */
export function LogbookDrawer() {
  const { logbookOpen, setLogbook, reports, resolved, xp, openDebrief, select, setView } = useGame();
  const solvedCount = useGame(resolvedTotal);
  useEffect(() => {
    if (!logbookOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLogbook(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logbookOpen, setLogbook]);
  if (!logbookOpen) return null;

  const list = Object.values(reports).sort((a, b) => b.at - a.at);
  const st = careerStats(list);
  const topics = topicStats(resolved);
  const next = recommendNext(resolved);
  const lv = levelInfo(solvedCount);

  return (
    <>
      <div className="kb-backdrop" onClick={() => setLogbook(false)} />
      <aside className="kb-drawer" role="dialog" aria-label="Logbook">
        <header className="kb-head">
          <span className="kb-title"><ClipboardList /> Logbook</span>
          <button className="icon-button" onClick={() => setLogbook(false)} aria-label="Close logbook"><X /></button>
        </header>
        <div className="kb-body">
          <div className="lb-rank"><b>{lv.rank}</b><span>{xp} XP · {solvedCount} of {tickets.length} tickets{lv.nextRank ? ` · ${lv.next! - solvedCount} more for ${lv.nextRank}` : ""}</span></div>
          <div className="lb-stats">
            <div><b>{st.stars}<small>/{Math.max(st.solved, 0) * 3}</small></b><span>Stars</span></div>
            <div><b>{st.solved ? fmtSla(st.avgSec) : "—"}</b><span>Avg. time</span></div>
            <div><b>{st.solved ? `${st.slaRate}%` : "—"}</b><span>Within SLA</span></div>
            <div><b>{st.flawless}</b><span>Flawless</span></div>
            <div><b>{st.hints}</b><span>Hints used</span></div>
          </div>

          <h3 className="kb-section">Skill coverage</h3>
          {topics.map((t) => (
            <div className="lb-topic" key={t.id}>
              <span>{t.label}</span>
              <div className="lb-bar" role="progressbar" aria-valuenow={t.done} aria-valuemax={t.total} aria-label={t.label}><i style={{ width: `${(100 * t.done) / t.total}%` }} /></div>
              <small>{t.done}/{t.total}</small>
            </div>
          ))}

          {next && (
            <>
              <h3 className="kb-section">Practise next</h3>
              <button className="lb-next" onClick={() => { select(next.id); setView("lab"); setLogbook(false); }}>
                <span><b>{next.id} · {next.subject}</b><small>{next.category} · fills your least-practised skill</small></span><ArrowRight />
              </button>
            </>
          )}

          <h3 className="kb-section">History</h3>
          {list.length === 0 && <p className="kb-empty">Resolve your first ticket and its debrief will be saved here.</p>}
          {list.map((r) => {
            const t = ticketById(r.id);
            return (
              <button key={r.id} className="lb-row" onClick={() => openDebrief(r.id)}>
                <Stars n={r.stars} />
                <span><b>{r.id}</b> {t?.subject}<small>{r.durationSec ? fmtSla(r.durationSec) : "—"} · {r.hints} hint{r.hints === 1 ? "" : "s"} · +{r.xp.total} XP{r.late ? " · SLA missed" : ""}</small></span>
                <ArrowRight />
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}