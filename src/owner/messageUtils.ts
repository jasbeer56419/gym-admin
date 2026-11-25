import type { Timestamp } from "firebase/firestore";

export type SegmentKey = "expiring" | "expired" | "dues" | "birthday" | "inactive";
export type Templates = Record<SegmentKey, string>;

export type MessageLog = {
  id: string;
  memberId: string;
  memberName: string;
  phone: string;
  segment: SegmentKey;
  channel: "whatsapp" | "sms";
  by: string;
  date: string; // "YYYY-MM-DD"
  createdAt?: Timestamp | null;
};

export const DEFAULT_TEMPLATES: Templates = {
  expiring:
    "Hi {name}, your {plan} membership at {gym} ends on {date} ({days} day(s) left). Renew now to keep your streak going!",
  expired:
    "Hi {name}, your {plan} membership at {gym} expired on {date}. We miss you! Renew today and get back to training.",
  dues:
    "Hi {name}, a balance of {due} is pending on your membership at {gym}. Please clear it at the front desk or reply here. Thank you!",
  birthday:
    "Happy Birthday {name}! Wishing you a strong and healthy year ahead. Team {gym}",
  inactive:
    "Hi {name}, we have not seen you at {gym} for a while. Everything okay? Come back and let's get your routine going again!",
};

// Replaces {name}, {gym} ... with real values. Unknown variables stay as they are.
export const fillTemplate = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);

export const waWithText = (phone: string, text: string) => {
  const d = phone.replace(/\D/g, "");
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}?text=${encodeURIComponent(text)}`;
};

export const smsWithText = (phone: string, text: string) =>
  `sms:${phone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(text)}`;