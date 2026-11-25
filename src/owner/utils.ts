import type { DurationUnit, Member } from "../types";

const pad = (n: number) => String(n).padStart(2, "0");

export const toStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayStr = () => toStr(new Date());

export const parseDate = (s: string) => new Date(`${s}T00:00:00`);

export const addDays = (s: string, n: number) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};

export const addMonths = (s: string, n: number) => {
  const d = parseDate(s);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  // Jan 31 + 1 month should be Feb 28, not Mar 3
  if (d.getDate() !== day) d.setDate(0);
  return toStr(d);
};

// A 1-month plan starting 15 Oct ends on 14 Nov. A 7-day plan starting today ends in 6 days.
export const endDateFor = (start: string, value: number, unit: DurationUnit) =>
  unit === "month" ? addDays(addMonths(start, value), -1) : addDays(start, value - 1);

export const daysBetween = (a: string, b: string) =>
  Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);

export const fmtDate = (s?: string) =>
  s
    ? parseDate(s).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const durationLabel = (value: number, unit: DurationUnit) =>
  `${value} ${unit}${value === 1 ? "" : "s"}`;

export const expiryText = (end: string) => {
  const d = daysBetween(todayStr(), end);
  if (d === 0) return "Expires today";
  if (d > 0) return `${d} day${d === 1 ? "" : "s"} left`;
  return `Expired ${-d} day${d === -1 ? "" : "s"} ago`;
};

export type MemberStatus =
  | "active"
  | "expiring"
  | "expired"
  | "frozen"
  | "no_plan"
  | "archived";

// Status is calculated from dates every time, so it is always up to date
export const memberStatus = (m: Member): MemberStatus => {
  if (m.archived) return "archived";
  if (!m.membershipEnd) return "no_plan";
  if (m.frozen) return "frozen";
  const today = todayStr();
  if (m.membershipEnd < today) return "expired";
  if (daysBetween(today, m.membershipEnd) <= 7) return "expiring";
  return "active";
};

export const statusMeta: Record<MemberStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-700" },
  expiring: { label: "Expiring soon", cls: "bg-amber-500/10 text-amber-700" },
  expired: { label: "Expired", cls: "bg-red-500/10 text-red-700" },
  frozen: { label: "Frozen", cls: "bg-sky-500/10 text-sky-700" },
  no_plan: { label: "No membership", cls: "bg-slate-500/10 text-slate-600" },
  archived: { label: "Archived", cls: "bg-slate-500/10 text-slate-500" },
};

export const fmtTime = (ts?: { toDate: () => Date } | null) =>
  ts ? ts.toDate().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : "—";

export const fmtDuration = (mins: number) =>
  mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;

export const minutesSince = (ts?: { toDate: () => Date } | null) =>
  ts ? Math.max(0, Math.round((Date.now() - ts.toDate().getTime()) / 60000)) : 0;