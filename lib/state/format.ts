const p2 = (n: number) => String(n).padStart(2, "0");

/** 522 -> "08:42", 4353 -> "1:12:33", negative -> "-00:30" (breached) */
export function fmtSla(sec: number) {
  const neg = sec < 0, s = Math.abs(Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (neg ? "-" : "") + (h ? `${h}:${p2(m)}:${p2(r)}` : `${p2(m)}:${p2(r)}`);
}
export function fmtAge(min: number) {
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  return `${h} hr${h > 1 ? "s" : ""} ago`;
}
export const fmtClock = (ms: number) => {
  const d = new Date(ms);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
};
