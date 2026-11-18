/**
 * Scenario registry. To add a scenario: create scenarios/<id>.tsx exporting a `Scenario`,
 * add it to `all` below, and set `scenarioId` on the ticket in data/tickets.ts.
 */
import type { Ticket } from "@/lib/data/tickets";
import type { Scenario } from "./types";
import { dhcpPool } from "./dhcp-pool";
import { financeErp } from "./finance-erp";

const all: Scenario[] = [dhcpPool,financeErp];

export const scenarios: Record<string, Scenario> = Object.fromEntries(all.map((s) => [s.id, s]));
export const scenarioFor = (t: Ticket): Scenario | undefined => (t.scenarioId ? scenarios[t.scenarioId] : undefined);
