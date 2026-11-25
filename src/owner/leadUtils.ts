import type { LeadStatus } from "../types";
import { daysBetween, fmtDate, todayStr } from "./utils";

// Keep these two lists identical to GOALS / SOURCES in MemberModal
export const LEAD_GOALS = [
  "General fitness",
  "Weight loss",
  "Muscle gain",
  "Strength",
  "Flexibility",
  "Rehabilitation",
  "Sports performance",
];

export const LEAD_SOURCES = [
  "Walk-in",
  "Referral",
  "Social media",
  "Website",
  "Advertisement",
  "Other",
];

export const LEAD_STATUS: Record<LeadStatus, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-sky-500/10 text-sky-700" },
  contacted: { label: "Contacted", cls: "bg-violet-500/10 text-violet-700" },
  trial: { label: "Trial booked", cls: "bg-amber-500/10 text-amber-700" },
  negotiation: { label: "Negotiation", cls: "bg-gold/15 text-gold-soft" },
  converted: { label: "Converted", cls: "bg-emerald-500/10 text-emerald-700" },
  lost: { label: "Lost", cls: "bg-red-500/10 text-red-700" },
};

export const OPEN_STATUSES: LeadStatus[] = ["new", "contacted", "trial", "negotiation"];

export const isOpen = (s: LeadStatus) => OPEN_STATUSES.includes(s);

export const followUpInfo = (date: string): { text: string; cls: string } => {
  if (!date) return { text: "Not scheduled", cls: "text-muted" };
  const d = daysBetween(todayStr(), date);
  if (d < 0) return { text: `Overdue by ${-d} day${d === -1 ? "" : "s"}`, cls: "text-red-600 font-medium" };
  if (d === 0) return { text: "Today", cls: "text-amber-700 font-medium" };
  if (d === 1) return { text: "Tomorrow", cls: "" };
  return { text: fmtDate(date), cls: "" };
};

export const waLink = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
};