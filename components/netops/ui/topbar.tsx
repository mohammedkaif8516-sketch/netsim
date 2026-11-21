"use client";

import { useState } from "react";
import { Activity, Bell, Check, ChevronDown, Pause, Play, ShieldCheck, X } from "lucide-react";
import { levelInfo, resolvedToday, resolvedTotal, slaHealth, useGame } from "@/lib/state/game-store";
import { fmtClock } from "@/lib/state/format";

export function Topbar() {
  const { xp, now, paused, togglePause, notes, readNotes, resetProgress } = useGame();
  const solved = useGame(resolvedTotal);
  const today = useGame(resolvedToday);
  const health = useGame(slaHealth);
  const lv = levelInfo(solved);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const unread = notes.filter((n) => !n.read).length;
  const toggleNotes = () => { if (showNotes) readNotes(); setShowNotes(!showNotes); setShowProfile(false); };
  const left = lv.next !== undefined ? lv.next - solved : 0;

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="NetOps World home"><span className="brand-mark"><Activity /></span><span>NETOPS<span className="brand-light">WORLD</span></span></a>
        <div className="topbar-divider" />
        <div className="rank-block"><span className="rank-icon"><ShieldCheck /></span><div><span className="rank-label">CURRENT RANK</span><strong>{lv.rank} <ChevronDown /></strong></div></div>
        <div className="xp-block" title={`${xp} XP · ${solved} ticket${solved === 1 ? "" : "s"} resolved${lv.nextRank ? ` · ${left} more for ${lv.nextRank}` : ""}`}>
          <div className="xp-copy"><span>LEVEL {String(lv.level).padStart(2, "0")}</span><span>{solved}{lv.next !== undefined && <> / {lv.next}</>} <small>tickets</small></span></div>
          <div className="xp-track"><i style={{ width: `${lv.pct}%` }} /></div>
        </div>
        <div className="topbar-spacer" />
        <div className="top-stat"><span className="stat-icon green"><Check /></span><div><b>{today}</b><small>Resolved today</small></div></div>
        <div className="top-stat sla-stat"><span className="sla-ring">{health}</span><div><b>{health}%</b><small>SLA health</small></div></div>
        <div className="game-clock"><span className="clock-live" /><span suppressHydrationWarning>{now ? fmtClock(now) : "--:--:--"}</span><small>{paused ? "PAUSED" : "LOCAL TIME"}</small></div>
        <button className={`pause-button ${paused ? "paused" : ""}`} onClick={togglePause} aria-label={paused ? "Resume game" : "Pause game"}>{paused ? <Play /> : <Pause />}{paused ? "Resume" : "Pause"}</button>
        <button className="icon-button top-icon" aria-label="Notifications" onClick={toggleNotes}><Bell />{unread > 0 && <i />}</button>
        <button className="profile-button" onClick={() => { setShowProfile(!showProfile); setShowNotes(false); }} aria-label="Open player profile"><span>AS</span></button>
      </header>

      {showNotes && (
        <div className="notes-popover" role="dialog" aria-label="Notifications">
          {notes.length === 0 ? <small>Nothing new. Resolve a ticket to see updates here.</small> : notes.map((n) => <div key={n.id}>{n.text}<br /><small>{fmtClock(n.at)}</small></div>)}
        </div>
      )}
      {showProfile && (
        <div className="profile-popover">
          <button className="close-popover" onClick={() => setShowProfile(false)} aria-label="Close profile"><X /></button>
          <span className="profile-avatar">AS</span><b>Alex Sharma</b><small>{lv.rank.toUpperCase()} · LEVEL {String(lv.level).padStart(2, "0")}</small>
          <div className="profile-xp"><span>{xp} XP · {solved} resolved</span><span>{lv.nextRank ? `${left} more → ${lv.nextRank}` : "Top rank reached"}</span></div>
          <div className="xp-track"><i style={{ width: `${lv.pct}%` }} /></div>
          <button className="quiet-button" style={{ marginTop: 10 }} onClick={() => { if (window.confirm("Reset all progress back to zero?")) { resetProgress(); setShowProfile(false); } }}>Reset progress</button>
        </div>
      )}
    </>
  );
}