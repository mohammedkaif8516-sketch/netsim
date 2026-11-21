/** How a resolved ticket is scored. One place, so the debrief, the store and the docs can't disagree. */
export const SLA_BONUS = 25;
export const CLEAN_BONUS = 20; // no hints used
export const ONE_HINT_BONUS = 10;

export interface XpBreakdown { base: number; sla: number; clean: number; total: number }

export function xpBreakdown(base: number, late: boolean, hints: number): XpBreakdown {
  const sla = late ? 0 : SLA_BONUS;
  const clean = hints === 0 ? CLEAN_BONUS : hints === 1 ? ONE_HINT_BONUS : 0;
  return { base, sla, clean, total: base + sla + clean };
}
/** 1 star for resolving, 2 for beating the SLA, 3 for beating it without hints */
export const starRating = (late: boolean, hints: number): 1 | 2 | 3 => (late ? 1 : hints === 0 ? 3 : 2);

/** console commands that only look, versus ones that change something */
const MODE_ONLY = /^(enable|en|configure terminal|conf t|configure|end|exit|\?|help|cls|clear screen)$/i;
const INSPECT = /^(show|sh|ping|trace|traceroute|tracert|arp|version|debug|\?)(\s|$)/i;
export type CmdKind = "mode" | "inspect" | "change";
export const classify = (line: string): CmdKind => {
  const l = line.trim();
  if (MODE_ONLY.test(l)) return "mode";
  return INSPECT.test(l) ? "inspect" : "change";
};