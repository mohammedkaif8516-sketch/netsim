"use client";

import { useState } from "react";
import { Activity, Bell, Check, ChevronDown, Pause, Play, ShieldCheck, X } from "lucide-react";
import { BASE_RESOLVED_TODAY, levelInfo, slaHealth, useGame } from "../state/game-store";
import { fmtClock } from "../state/format";

export function Topbar() {
  const { xp, now, paused, togglePause, resolved, notes, readNotes } = useGame();
  const health = useGame(slaHealth);
  const lv = levelInfo(xp);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const unread = notes.filter((n) => !n.read).length;
  const toggleNotes = () => { if (showNotes) readNotes(); setShowNotes(!showNotes); setShowProfile(false); };

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="NetOps World home"><span className="brand-mark"><Activity /></span><span>NETOPS<span className="brand-light">WORLD</span></span></a>
        <div className="topbar-divider" />
        <div className="rank-block"><span className="rank-icon"><ShieldCheck /></span><div><span className="rank-label">CURRENT RANK</span><strong>{lv.rank} <ChevronDown /></strong></div></div>
        <div className="xp-block">
          <div className="xp-copy"><span>LEVEL {String(lv.level).padStart(2, "0")}</span><span>{xp} <small>{lv.next ? `/ ${lv.next} XP` : "XP · max"}</small></span></div>
          <div className="xp-track"><i style={{ width: `${lv.pct}%` }} /></div>
        </div>
        <div className="topbar-spacer" />
        <div className="top-stat"><span className="stat-icon green"><Check /></span><div><b>{BASE_RESOLVED_TODAY + Object.keys(resolved).length}</b><small>Resolved today</small></div></div>
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
          <div className="profile-xp"><span>{xp} XP</span><span>{lv.next ? `${lv.pct}% to next level` : "Max level"}</span></div>
          <div className="xp-track"><i style={{ width: `${lv.pct}%` }} /></div>
        </div>
      )}
    </>
  );
}
