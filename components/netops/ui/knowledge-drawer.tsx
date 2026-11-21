"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, Copy, Search, X } from "lucide-react";
import type { Ticket } from "@/lib/data/tickets";
import { DEVICE_LABEL, MODE_LABEL, TOPICS, knowledge, topicsFor, type KbDevice, type KbEntry, type KbTopic } from "@/lib/data/knowledge";
import { useGame } from "@/lib/state/game-store";

const DEVICES: (KbDevice | "all")[] = ["all", "router", "switch", "host"];

function Entry({ k, copied, onCopy }: { k: KbEntry; copied: boolean; onCopy: () => void }) {
  return (
    <article className="kb-entry">
      <div className="kb-entry-top">
        <code className="kb-cmd">{k.command}</code>
        <span className={`kb-tag kb-tag-${k.device}`}>{DEVICE_LABEL[k.device]}</span>
      </div>
      <p>{k.what}</p>
      {k.tip && <p className="kb-tip">💡 {k.tip}</p>}
      <div className="kb-example">
        <span className="kb-mode">{MODE_LABEL[k.mode]}</span>
        <button className="kb-copy" onClick={onCopy} aria-label={`Copy ${k.example}`}>
          <code>{k.example}</code>{copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </article>
  );
}

function Guide() {
  return (
    <div className="kb-guide">
      <h3>How a ticket works</h3>
      <ol>
        <li>Pick a ticket in the queue. Read the report and the investigation checklist on the right.</li>
        <li>Press <b>Investigate ticket</b> (or open its department on the map) to enter the lab.</li>
        <li>Click a device to open its console. Look, don&apos;t guess: <code>show</code> commands first.</li>
        <li>Fix the fault. The checklist re-runs after every command and ticks by itself.</li>
        <li>When every check passes, <b>Mark resolved</b> unlocks and awards XP.</li>
      </ol>
      <h3>Scoring and timers</h3>
      <ul>
        <li>Each ticket gives base XP, plus 25 for resolving inside its SLA.</li>
        <li>SLA timers count down live. <b>Pause</b> stops them, and they resume where they left off.</li>
        <li>SLA health drops for every ticket that runs out of time or is resolved late.</li>
      </ul>
      <h3>A method that works</h3>
      <ol>
        <li><b>Link:</b> is the port up? <code>show ip interface brief</code>, <code>show interfaces status</code>.</li>
        <li><b>Address:</b> right IP, mask and gateway on the host? <code>show ip</code>.</li>
        <li><b>VLAN:</b> is the port in the right VLAN, and does the trunk carry it?</li>
        <li><b>Gateway:</b> can the host ping its own gateway?</li>
        <li><b>Routing:</b> does the path exist <i>and</i> come back? <code>show ip route</code> on every hop.</li>
        <li><b>Services:</b> DHCP, VTP and the like, once the layers below are healthy.</li>
      </ol>
      <p className="kb-tip">A <b>timeout</b> usually means the request arrived but the reply got lost. <b>Unreachable</b> means a router had no route.</p>
      <h3>Console tips</h3>
      <ul>
        <li><code>Tab</code> completes a command, <code>?</code> lists what can come next, ↑ / ↓ walk your history.</li>
        <li><code>end</code> jumps back to the <code>#</code> prompt from any config mode.</li>
        <li><b>Reset lab</b> restores the broken starting state. Switching to another ticket also starts that lab fresh.</li>
        <li>Stuck? <b>Need a hint?</b> in the lab reveals up to three hints, vaguest first.</li>
      </ul>
    </div>
  );
}

export function KnowledgeDrawer({ ticket }: { ticket: Ticket }) {
  const { kbOpen, kbTab, setKbTab, closeKb } = useGame();
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<KbTopic | "all">("all");
  const [device, setDevice] = useState<KbDevice | "all">("all");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!kbOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeKb(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kbOpen, closeKb]);

  const relevant = useMemo(() => topicsFor(ticket), [ticket]);
  const focus: KbTopic[] = relevant.filter((t) => t !== "basics");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = knowledge.filter((k) =>
      (topic === "all" || k.topic === topic) &&
      (device === "all" || k.device === device) &&
      (!needle || [k.command, k.example, k.what, k.tip ?? ""].some((x) => x.toLowerCase().includes(needle))));
    // a match in the command itself beats a match in the description
    return needle ? [...list].sort((a, b) => Number(!a.command.toLowerCase().includes(needle)) - Number(!b.command.toLowerCase().includes(needle))) : list;
  }, [q, topic, device]);

  if (!kbOpen) return null;

  const copy = (k: KbEntry) => {
    void navigator.clipboard?.writeText(k.example);
    setCopied(k.id);
    setTimeout(() => setCopied((c) => (c === k.id ? null : c)), 1200);
  };
  const grouped = q.trim() === "" && topic === "all" && device === "all";
  const forTicket = grouped ? filtered.filter((k) => focus.includes(k.topic)) : [];
  const rest = grouped ? filtered.filter((k) => !focus.includes(k.topic)) : filtered;

  return (
    <>
      <div className="kb-backdrop" onClick={closeKb} />
      <aside className="kb-drawer" role="dialog" aria-label="Knowledge base">
        <header className="kb-head">
          <span className="kb-title"><BookOpen /> Knowledge base</span>
          <button className="icon-button" onClick={closeKb} aria-label="Close knowledge base"><X /></button>
        </header>
        <div className="kb-tabs" role="tablist">
          <button role="tab" aria-selected={kbTab === "commands"} className={kbTab === "commands" ? "on" : ""} onClick={() => setKbTab("commands")}>Commands</button>
          <button role="tab" aria-selected={kbTab === "guide"} className={kbTab === "guide" ? "on" : ""} onClick={() => setKbTab("guide")}>How it works</button>
        </div>
        {kbTab === "guide" ? <div className="kb-body"><Guide /></div> : (
          <>
            <div className="kb-filters">
              <label className="kb-search"><Search size={13} /><input autoFocus placeholder="Search commands, e.g. vlan, route, dhcp…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
              <div className="kb-chips">
                <button className={topic === "all" ? "on" : ""} onClick={() => setTopic("all")}>All</button>
                {TOPICS.map((t) => <button key={t.id} className={topic === t.id ? "on" : ""} onClick={() => setTopic(t.id)}>{t.label}{focus.includes(t.id) && <i title="Relevant to this ticket" />}</button>)}
              </div>
              <div className="kb-chips">
                {DEVICES.map((d) => <button key={d} className={device === d ? "on" : ""} onClick={() => setDevice(d)}>{d === "all" ? "Any device" : DEVICE_LABEL[d]}</button>)}
              </div>
            </div>
            <div className="kb-body">
              {filtered.length === 0 && <p className="kb-empty">No commands match &ldquo;{q}&rdquo;.</p>}
              {forTicket.length > 0 && <>
                <h3 className="kb-section">For {ticket.id} <small>{ticket.category}</small></h3>
                {forTicket.map((k) => <Entry key={k.id} k={k} copied={copied === k.id} onCopy={() => copy(k)} />)}
                <h3 className="kb-section">Everything else</h3>
              </>}
              {rest.map((k) => <Entry key={k.id} k={k} copied={copied === k.id} onCopy={() => copy(k)} />)}
            </div>
          </>
        )}
      </aside>
    </>
  );
}