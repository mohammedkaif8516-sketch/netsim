/**
 * Scenario registry. To add a scenario: create lib/scenarios/<id>.tsx exporting a `Scenario`,
 * add it to `all` below, and set `scenarioId` on the ticket in lib/data/tickets.ts.
 */
import type { Ticket } from "@/lib/data/tickets";
import type { Scenario } from "./types";
import { dhcpPool } from "./dhcp-pool";
import { defaultRoute } from "./default-route";
import { staticRoute } from "./static-route";
import { nextHop } from "./next-hop";
import { dhcpConflict, dhcpExhausted, dhcpRouter, dhcpService } from "./dhcp-variants";
import { badGateway, badMask, linkShutdown } from "./lan-faults";
import { interVlan, trunkAllowed, vlanAccess, vlanMissing, vtpClient } from "./vlan-faults";
import { missingReturn, printerGateway } from "./more-faults";

const all: Scenario[] = [
  dhcpPool, dhcpExhausted, dhcpRouter, dhcpService, dhcpConflict,
  defaultRoute, staticRoute, nextHop,
  linkShutdown, badGateway, badMask,
  vlanAccess, vlanMissing, trunkAllowed, vtpClient, interVlan,
  missingReturn, printerGateway,
];

export const scenarios: Record<string, Scenario> = Object.fromEntries(all.map((s) => [s.id, s]));
export const scenarioFor = (t: Ticket): Scenario | undefined => (t.scenarioId ? scenarios[t.scenarioId] : undefined);