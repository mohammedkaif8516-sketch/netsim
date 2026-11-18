"use client";
import { Check, Sparkles } from "lucide-react";
import type { Check as CheckDef } from "@/lib/scenarios/types";

export function Checklist({ checks, results }: { checks?: CheckDef[]; results: boolean[] }) {
  return (
    <div className="checklist">
      <div className="checklist-heading">
        <span>INVESTIGATION CHECKLIST</span>
        <span className="beginner-tag"><Sparkles /> BEGINNER</span>
      </div>
      {!checks?.length && <div className="check-row"><span className="check-empty" /><span>The lab for this ticket hasn&apos;t been built yet.</span></div>}
      {checks?.map((c, i) => (
        <div className="check-row" key={c.id}>
          {results[i] ? <span className="check-done"><Check size={12} /></span> : <span className="check-empty" />}
          <span style={results[i] ? { opacity: 0.6, textDecoration: "line-through" } : undefined}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}
