import type { ComponentType } from "react";
import type { State } from "@/components/simulator/netsim";

/** a live, pure test against the simulator state. It re-runs on every CLI command. */
export interface Check {
  id: string;
  /** shown in the investigation checklist */
  label: string;
  test: (s: State) => boolean;
}

export interface Scenario {
  id: string;
  /** shown in the lab heading, e.g. "DHCP connectivity" */
  title: string;
  /** NetLab canvas */
  canvas: { title: string; width: number; height: number };
  /** devices + cables, including the injected fault (via each device's `init`) */
  Topology: ComponentType;
  /** all must pass before the ticket can be resolved */
  checks: Check[];
  /** commands worth trying, shown above the lab */
  suggested: { where: string; commands: string[] }[];
  /** revealed one at a time, vaguest first */
  hints: string[];
  /** base XP for resolving (+25 if inside SLA) */
  xp: number;
}
