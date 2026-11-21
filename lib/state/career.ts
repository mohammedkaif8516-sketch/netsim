/** Career stats derived from the saved reports. Pure functions. */
import { tickets, type Ticket } from "@/lib/data/tickets";

export type CareerTopic = "basics" | "dhcp" | "routing" | "vlan" | "vtp";
export const CAREER_TOPICS: { id: CareerTopic; label: string }[] = [
  { id: "basics", label: "Layer 1 / basics" },
  { id: "dhcp", label: "DHCP" },
  { id: "routing", label: "Routing / IP" },
  { id: "vlan", label: "VLAN / trunk" },
  { id: "vtp", label: "VTP" },
];

/** the single skill a ticket mainly trains */
export function primaryTopic(t: Ticket): CareerTopic {
  const c = t.category.toLowerCase();
  if (c.includes("dhcp")) return "dhcp";
  if (c.includes("vtp")) return "vtp";
  if (c.includes("inter-vlan")) return "routing";
  if (c.includes("vlan") || c.includes("trunk") || c.includes("switching")) return "vlan";
  if (c.includes("layer 1")) return "basics";
  return "routing";
}

export interface TopicStat { id: CareerTopic; label: string; done: number; total: number }
export function topicStats(resolved: Record<string, unknown>): TopicStat[] {
  return CAREER_TOPICS.map((tp) => {
    const own = tickets.filter((t) => primaryTopic(t) === tp.id);
    return { ...tp, total: own.length, done: own.filter((t) => resolved[t.id]).length };
  }).filter((s) => s.total > 0);
}

interface ReportLike { durationSec: number; hints: number; late: boolean; stars: number }
export function careerStats(reports: ReportLike[]) {
  const n = reports.length;
  return {
    solved: n,
    stars: reports.reduce((a, r) => a + r.stars, 0),
    avgSec: n ? Math.round(reports.reduce((a, r) => a + r.durationSec, 0) / n) : 0,
    hints: reports.reduce((a, r) => a + r.hints, 0),
    slaRate: n ? Math.round((100 * reports.filter((r) => !r.late).length) / n) : 0,
    flawless: reports.filter((r) => r.stars === 3).length,
  };
}

/**
 * Suggest the next ticket: among the skills you've practised least (lowest completion), take the open ticket with the
 * highest priority and tightest SLA. Falls back to any open ticket.
 */
export function recommendNext(resolved: Record<string, unknown>): Ticket | undefined {
  const open = tickets.filter((t) => !resolved[t.id]);
  if (!open.length) return undefined;
  const stats = topicStats(resolved).filter((s) => s.done < s.total).sort((a, b) => a.done / a.total - b.done / b.total);
  const weakest = stats[0]?.id;
  const pool = open.filter((t) => primaryTopic(t) === weakest);
  return (pool.length ? pool : open).slice().sort((a, b) => a.priority.localeCompare(b.priority) || a.slaSec - b.slaSec)[0];
}