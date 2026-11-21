/**
 * tickets.ts — ticket definitions only. No UI, no state.
 *
 *  - `deptId`     -> where it happens (data/world.ts); location text is derived from it
 *  - `slaSec`     -> SLA budget in seconds; the live countdown lives in state/game-store.ts
 *  - `scenarioId` -> which lab to load (scenarios/index.ts). Tickets without one show "lab not built yet".
 */
export type Priority = "P1" | "P2" | "P3";

export interface Ticket {
  id: string;
  priority: Priority;
  category: string;
  subject: string;
  reporter: string;
  deptId: string;
  slaSec: number;
  ageMin: number;
  description: string;
  assignee: "me" | "queue";
  scenarioId?: string;
}

const t = (
  id: string, priority: Priority, category: string, subject: string, reporter: string,
  deptId: string, slaSec: number, ageMin: number, description: string,
  assignee: Ticket["assignee"] = "queue", scenarioId?: string,
): Ticket => ({ id, priority, category, subject, reporter, deptId, slaSec, ageMin, description, assignee, scenarioId });

export const tickets: Ticket[] = [
  t("INC-2841", "P1", "DHCP / Services", "New starters cannot connect", "Maya Patel", "blr-hr", 522, 6,
    "Three new starters in HR are unable to get online. Their laptops show a self-assigned address, and onboarding is blocked.", "me", "dhcp-pool"),
  t("INC-2838", "P2", "Routing", "Finance cannot reach ERP", "Jonah Brooks", "aus-fin", 1456, 18,
    "Finance workstations can reach local services but the ERP application in the data center is timing out.", "queue", "missing-return"),
  t("INC-2835", "P2", "Switching / VLAN", "Warehouse scanners offline", "Lena Fischer", "muc-wh", 1868, 23,
    "Handheld scanners lost connectivity after a switch replacement. Wired office PCs still appear to be working.", "queue", "vlan-missing"),
  t("INC-2829", "P3", "Connectivity", "Meeting room printer unreachable", "Aarav Shah", "blr-sales", 4353, 41,
    "The printer in the east meeting area is online but users cannot send jobs to it.", "me", "printer-gateway"),
  t("INC-2826", "P3", "Interface / Layer 1", "Branch workstation link is down", "Priya Nair", "blr-hr", 4700, 52,
    "A desk move was completed this morning. The laptop has no network connection, and the network port may have been left disabled.", "me", "link-shutdown"),
  t("INC-2824", "P2", "IP / Subnetting", "New subnet cannot reach local services", "Ethan Cole", "aus-fin", 2530, 60,
    "Finance received new workstation addresses, but devices cannot communicate with the department printer or gateway.", "queue", "bad-mask"),
  t("INC-2822", "P3", "IP / Default gateway", "Laptop cannot reach anything off-subnet", "Sofia Weber", "muc-sales", 5144, 64,
    "The laptop can reach nearby devices, but company applications on other networks are unavailable.", "queue", "bad-gateway"),
  t("INC-2819", "P2", "Routing / Static route", "Remote office cannot reach HR", "Noah Williams", "aus-hr", 2212, 68,
    "Staff at the remote office can use local resources but cannot reach the HR subnet at headquarters.", "queue", "static-route"),
  t("INC-2817", "P2", "Routing / Next hop", "Warehouse traffic is sent to the wrong router", "Lukas Bauer", "muc-wh", 2886, 72,
    "Warehouse computers can reach their local gateway, but traffic to the data center follows an incorrect path.", "queue", "next-hop"),
  t("INC-2815", "P3", "Routing / Default route", "Office users cannot reach the internet", "Amara Okafor", "blr-sales", 5655, 120,
    "Internal company services work normally, but users cannot open any external websites.", "me", "default-route"),
  t("INC-2812", "P2", "DHCP / Address pool", "New laptops receive no network address", "Grace Kim", "aus-hr", 1771, 125,
    "Several new laptops show an automatic private address instead of joining the HR network.", "queue", "dhcp-exhausted"),
  t("INC-2810", "P3", "DHCP / Default router", "New hire can reach only nearby devices", "Ravi Menon", "blr-hr", 6368, 130,
    "A new hire received an address automatically but cannot reach shared services outside the local subnet.", "me", "dhcp-router"),
  t("INC-2808", "P2", "DHCP / Service", "All DHCP clients lost connectivity", "Mia Thompson", "aus-fin", 2028, 135,
    "Existing devices are still online, but newly connected workstations cannot obtain an address from the network.", "queue", "dhcp-service"),
  t("INC-2806", "P3", "DHCP / Address conflict", "A workstation reports an IP address conflict", "Jonas Richter", "muc-wh", 6747, 180,
    "One recently connected workstation reports a duplicate address and intermittently drops off the network.", "queue", "dhcp-conflict"),
  t("INC-2804", "P2", "Switching / VLAN", "Warehouse scanners are on the office VLAN", "Isabella Schmidt", "muc-wh", 1634, 185,
    "Scanners power on and connect to the switch, but they cannot reach warehouse systems after being moved to a new port.", "queue", "vlan-access"),
  t("INC-2802", "P2", "Switching / Trunk", "New floor cannot reach its gateway", "Caleb Morgan", "aus-fin", 2345, 240,
    "Devices on the new floor can communicate locally, but the VLAN cannot reach its router across the switch uplink.", "queue", "trunk-allowed"),
  t("INC-2800", "P3", "Switching / VTP", "New switch is missing the department VLAN", "Anika Rao", "blr-hr", 4122, 245,
    "The HR VLAN exists on the distribution switch but is absent from the newly installed access switch.", "me", "vtp-client"),
  t("INC-2798", "P2", "Routing / Inter-VLAN", "Finance and HR cannot communicate", "Daniel Foster", "aus-fin", 2658, 250,
    "Both departments have working local networks, but Finance users cannot reach approved HR services on the other VLAN.", "queue", "inter-vlan"),
];

export const ticketById = (id: string) => tickets.find((x) => x.id === id);
export const priorityLabel: Record<Priority, string> = { P1: "Critical", P2: "High", P3: "Normal" };