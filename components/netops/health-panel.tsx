"use client";

import { ChevronDown, Clock3, Cpu, Radio } from "lucide-react";

/** NOTE: still static demo data. Next step: derive from open tickets and scenario state. */
export function HealthPanel() {
  const path = "M0 55 C25 52 31 37 55 42 S89 48 111 33 S150 40 177 30 S207 40 235 26 S276 35 300 27 S335 41 363 32 S402 40 429 19 S465 31 490 28 S521 35 548 21 S590 30 614 17 S660 28 700 11";
  return (
    <section className="activity-panel">
      <div className="activity-heading"><div><p className="eyebrow">NETWORK HEALTH</p><h2>Global service status</h2></div><button className="quiet-button">Last 24 hours <ChevronDown /></button></div>
      <div className="health-summary">
        <div className="health-number"><strong>99.98<span>%</span></strong><small>Global availability <span>+0.02%</span></small></div>
        <div className="health-chart" aria-label="Network availability trend">
          <div className="chart-grid"><i /><i /><i /></div>
          <svg viewBox="0 0 700 90" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2dd4bf" stopOpacity=".25" /><stop offset="1" stopColor="#2dd4bf" stopOpacity="0" /></linearGradient></defs>
            <path className="chart-area" d={`${path} L700 90 L0 90Z`} /><path className="chart-line" d={path} />
          </svg>
          <div className="chart-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>NOW</span></div>
        </div>
      </div>
      <div className="health-metrics">
        <div><span className="metric-mark mint"><Radio /></span><span><b>38 / 38</b><small>Sites connected</small></span></div>
        <div><span className="metric-mark blue"><Cpu /></span><span><b>1,284</b><small>Devices monitored</small></span></div>
        <div><span className="metric-mark amber"><Clock3 /></span><span><b>18 ms</b><small>Avg. latency</small></span></div>
      </div>
    </section>
  );
}
