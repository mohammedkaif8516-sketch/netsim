"use client";

import { useEffect } from "react";
import { BookOpen, CircleHelp, ClipboardList, Pause } from "lucide-react";
import { ticketById, tickets, type Ticket } from "@/lib/data/tickets";
import { scenarioFor } from "@/lib/scenarios";
import { useGame } from "@/lib/state/game-store";
import { useCheckResults, useLabStore } from "@/lib/state/use-lab";
import { TicketQueue } from "./ticket-queue";
import { NetworkLab } from "./network-lab";
import { WorldMap } from "./world-map";
import { Topbar } from "./ui/topbar";
import { TicketDetail } from "./ui/ticket-detail";
import { HealthPanel } from "./ui/health-panel";
import { KnowledgeDrawer } from "./ui/knowledge-drawer";
import { DebriefModal } from "./ui/debrief-modal";
import { LogbookDrawer } from "./ui/logbook-drawer";
import { useLabRecorder } from "@/lib/state/lab-session";
import { hydrateSnapshots } from "@/lib/state/lab-snapshots";


/** Composition only: state lives in state/, data in data/, labs in scenarios/. */
export function NetOpsDashboard() {
  const { selectedId, view, setView, select, paused, togglePause, openKb, setLogbook } = useGame();
  const ticket = ticketById(selectedId) ?? tickets[0];
  const scenario = scenarioFor(ticket);
  const store = useLabStore(ticket.id);
  const results = useCheckResults(store, scenario?.checks ?? []);
  useLabRecorder(ticket.id, store, () => useGame.getState().paused); // records console commands for the debrief

  // hydrate persisted XP / resolved tickets, start deadlines, and run the 1s clock
  useEffect(() => {
    void useGame.persist.rehydrate();
    hydrateSnapshots(); // saved labs from earlier visits, so the queue can show your progress
    useGame.getState().init();
    const id = setInterval(() => useGame.getState().tick(), 1000);
    useGame.getState().tick();
    return () => clearInterval(id);
  }, []);

  const openTicket = (t: Ticket) => { select(t.id); setView("lab"); };

  return (
    <main className="netops-shell">
      <Topbar />
      <div className="dashboard-titlebar">
        <div><span className="breadcrumb-label">OPERATIONS CENTER</span><span className="slash">/</span><span className="current-view">{view === "map" ? "Network overview" : "Department network lab"}</span></div>
        <div className="titlebar-actions"><span className="network-status"><i /> NETWORK ONLINE</span><button className="secondary-action" onClick={() => setLogbook(true)}><ClipboardList /> Logbook</button><button className="secondary-action" onClick={() => openKb("commands")}><BookOpen /> Knowledge base</button><button className="help-action" aria-label="How it works" onClick={() => openKb("guide")}><CircleHelp /></button></div>
      </div>
      {paused && <div className="paused-banner"><Pause /> Training simulation paused <span>Ticket timers are stopped</span><button onClick={togglePause}>Resume</button></div>}

      <div className="workspace-grid">
        <TicketQueue />
        <section className="center-column">
          <div style={{ display: view === "map" ? undefined : "none" }}><WorldMap ticket={ticket} onOpenTicket={openTicket} store={store} scenario={scenario} results={results} /></div>
          {/* the lab stays mounted while its ticket is selected, so progress survives a trip to the map */}
          <div style={{ display: view === "lab" ? undefined : "none" }}>
            <NetworkLab key={ticket.id} ticket={ticket} scenario={scenario} store={store}
              passed={results.filter(Boolean).length} total={results.length} onBack={() => setView("map")} />
          </div>
          <HealthPanel />
        </section>
        <TicketDetail ticket={ticket} scenario={scenario} results={results} />
      </div>
      <KnowledgeDrawer ticket={ticket} />
      <LogbookDrawer />
      <DebriefModal />
      <footer className="app-footer"><span>NETOPS WORLD <span>TRAINING SIMULATOR</span></span><span>BUILD 0.7.0 <i /> ENVIRONMENT: SANDBOX</span></footer>
    </main>
  );
}