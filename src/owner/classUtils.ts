import type { GymClass, Member, MembershipPlan, RosterStatus } from "../types";
import { addDays, fmtDate, parseDate } from "./utils";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const JS_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const ACTIVITIES = [
  "Yoga",
  "Zumba",
  "Spinning",
  "CrossFit",
  "HIIT",
  "Pilates",
  "Aerobics",
  "Meditation",
  "Boxing",
  "Strength Circuit",
];

export const dayName = (date: string) => JS_DAYS[parseDate(date).getDay()];

// Monday of the week that contains this date
export const mondayOf = (date: string) =>
  addDays(date, -((parseDate(date).getDay() + 6) % 7));

export const fmtT = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export const sessionId = (classId: string, date: string) => `${classId}_${date}`;

export const ROSTER_STATUS: Record<RosterStatus, { label: string; cls: string }> = {
  booked: { label: "Booked", cls: "bg-sky-500/10 text-sky-700" },
  attended: { label: "Present", cls: "bg-emerald-500/10 text-emerald-700" },
  no_show: { label: "No-show", cls: "bg-red-500/10 text-red-700" },
};

// Returns the reason a member cannot book this class, or null if they can
export function bookingBlock(
  m: Member,
  c: GymClass,
  date: string,
  plans: MembershipPlan[]
): string | null {
  if (m.archived) return "This member is archived.";
  if (!m.membershipEnd) return "This member has no membership.";
  if (m.frozen) return "The membership is frozen.";
  if (m.membershipStart > date) return `Membership starts on ${fmtDate(m.membershipStart)}.`;
  if (m.membershipEnd < date) {
    return `Membership ends on ${fmtDate(m.membershipEnd)}, before this class.`;
  }
  const plan = plans.find((p) => p.id === m.membershipPlanId);
  if (plan && (plan.branchIds ?? []).length > 0 && !plan.branchIds.includes(c.branchId)) {
    return `The ${plan.name} plan is not valid at ${c.branchName}.`;
  }
  return null;
}