"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Clock3, Cpu, Radio } from "lucide-react";
import { areaPath, linePath, series, snapshot } from "@/lib/state/health";
import { useGame } from "@/lib/state/game-store";

const WINDOWS = [24, 6] as const;
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

/** Everything here is derived from the tickets (lib/state/health.ts): open incidents pull it down, resolving them restores it. */
export function HealthPanel() {
  const resolved = useGame((s) => s.resolved);
  const now = useGame((s) => s.now);
  const startedAt = useGame((s) => s.startedAt);
  const [hours, setHours] = useState<(typeof WINDOWS)[number]>(24);

  const h = useMemo(() => snapshot(resolved), [resolved]);
  const values = useMemo(() => (now !== null && startedAt !== null ? series(resolved, startedAt, now, hours) : []), [resolved, now, startedAt, hours]);
  const line = linePath(values);
  const delta = Math.round((h.availability - h.baseline) * 100) / 100;
  const [whole, frac] = h.availability.toFixed(2).split(".");
  const labels = now === null ? ["", "", "", "", "NOW"] : [0, 1, 2, 3].map((i) => hhmm(now - hours * 3_600_000 * (1 - i / 4))).concat("NOW");

  return (
    <section className="activity-panel">
      <div className="activity-heading">
        <div><p className="eyebrow">NETWORK HEALTH</p><h2>Global service status</h2></div>
        <button className="quiet-button" onClick={() => setHours(hours === 24 ? 6 : 24)} aria-label={`Showing last ${hours} hours. Click to change`}>Last {hours} hours <ChevronDown /></button>
      </div>
      <div className="health-summary">
        <div className="health-number">
          <strong>{whole}.{frac}<span>%</span></strong>
          <small>Global availability <span style={delta < 0 ? { color: "#ff6b6b" } : undefined} title="Change since this session started">{delta >= 0 ? "+" : "−"}{Math.abs(delta).toFixed(2)}%</span></small>
        </div>
        <div className="health-chart" aria-label="Network availability trend">
          <div className="chart-grid"><i /><i /><i /></div>
          <svg viewBox="0 0 700 90" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity=".25" /><stop offset="1" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient></defs>
            <path className="chart-area" d={areaPath(line)} /><path className="chart-line" d={line} />
          </svg>
          <div className="chart-labels">{labels.map((l, i) => <span key={i}>{l}</span>)}</div>
        </div>
      </div>
      <div className="health-metrics">
        <div><span className="metric-mark mint"><Radio /></span><span><b>{h.sitesConnected} / {h.sitesTotal}</b><small>Sites connected{h.sitesDegraded > 0 && ` · ${h.sitesDegraded} degraded`}</small></span></div>
        <div><span className="metric-mark blue"><Cpu /></span><span><b>{h.devicesTotal.toLocaleString("en-US")}</b><small>Devices monitored{h.devicesAlerting > 0 && ` · ${h.devicesAlerting} alerting`}</small></span></div>
        <div><span className="metric-mark amber"><Clock3 /></span><span><b>{h.latencyMs} ms</b><small>Avg. latency</small></span></div>
      </div>
    </section>
  );
}