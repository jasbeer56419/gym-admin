import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  Cake,
  Clock,
  History,
  MessageCircle,
  MessageSquare,
  Save,
  Send,
  UserX,
  Wallet,
  CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import type { Member, Membership } from "../../types";
import { useOwner } from "../OwnerContext";
import {
  daysBetween,
  expiryText,
  fmtDate,
  memberStatus,
  rupee,
  todayStr,
} from "../utils";
import {
  DEFAULT_TEMPLATES,
  fillTemplate,
  smsWithText,
  waWithText,
  type MessageLog,
  type SegmentKey,
  type Templates,
} from "../messageUtils";

type Tab = SegmentKey | "templates" | "history";

type Row = {
  m: Member;
  detail: string;
  vars: Record<string, string>;
};

const SEGMENTS: { key: SegmentKey; label: string; icon: LucideIcon; empty: string }[] = [
  {
    key: "expiring",
    label: "Expiring soon",
    icon: CalendarClock,
    empty: "No memberships are expiring in the next 7 days.",
  },
  {
    key: "expired",
    label: "Recently expired",
    icon: Clock,
    empty: "No memberships have expired in the last 30 days.",
  },
  {
    key: "dues",
    label: "Dues pending",
    icon: Wallet,
    empty: "No members have a pending balance.",
  },
  {
    key: "birthday",
    label: "Birthdays today",
    icon: Cake,
    empty: "No members have a birthday today.",
  },
  {
    key: "inactive",
    label: "Not seen lately",
    icon: UserX,
    empty: "All active members are visiting regularly.",
  },
];

const VARIABLES = ["{name}", "{gym}", "{plan}", "{date}", "{days}", "{due}"];

const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

const when = (l: MessageLog) =>
  l.createdAt
    ? l.createdAt.toDate().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "just now";

export default function Notifications() {
  const { businessId, business, branchId } = useOwner();
  const { profile } = useAuth();
  const actor = profile?.name || "Staff";

  const [members, setMembers] = useState<Member[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [templates, setTemplates] = useState<Templates>(DEFAULT_TEMPLATES);
  const [draft, setDraft] = useState<Templates>(DEFAULT_TEMPLATES);
  const [loaded, setLoaded] = useState({ members: false, memberships: false });
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("expiring");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    const fail = () => setError("Could not load some data. Please try again.");

    const u1 = onSnapshot(
      collection(db, "businesses", businessId, "members"),
      (snap) => {
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member));
        setLoaded((l) => ({ ...l, members: true }));
      },
      fail
    );
    const u2 = onSnapshot(
      collection(db, "businesses", businessId, "memberships"),
      (snap) => {
        setMemberships(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Membership));
        setLoaded((l) => ({ ...l, memberships: true }));
      },
      fail
    );
    const u3 = onSnapshot(
      query(
        collection(db, "businesses", businessId, "messageLogs"),
        orderBy("createdAt", "desc"),
        limit(200)
      ),
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MessageLog)),
      () => {
        /* history is optional */
      }
    );
    const u4 = onSnapshot(
      doc(db, "businesses", businessId, "meta", "templates"),
      (snap) => {
        const merged = {
          ...DEFAULT_TEMPLATES,
          ...(snap.exists() ? (snap.data() as Partial<Templates>) : {}),
        };
        setTemplates(merged);
        setDraft(merged);
      },
      () => {
        /* keep defaults */
      }
    );
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [businessId]);

  const today = todayStr();
  const gymName = business?.name ?? "our gym";

  const rows = useMemo(() => {
    const live = members.filter(
      (m) => !m.archived && !!m.phone && (branchId === "all" || m.branchId === branchId)
    );
    const byId = new Map(live.map((m) => [m.id, m]));

    const base = (m: Member): Record<string, string> => ({
      name: m.name.split(" ")[0],
      gym: gymName,
      plan: m.membershipPlan || "gym",
      date: fmtDate(m.membershipEnd),
      days: m.membershipEnd ? String(Math.max(0, daysBetween(today, m.membershipEnd))) : "",
      due: "",
    });

    const out: Record<SegmentKey, Row[]> = {
      expiring: [],
      expired: [],
      dues: [],
      birthday: [],
      inactive: [],
    };

    live.forEach((m) => {
      const st = memberStatus(m);

      if (st === "expiring") {
        out.expiring.push({ m, detail: expiryText(m.membershipEnd), vars: base(m) });
      }
      if (st === "expired" && daysBetween(m.membershipEnd, today) <= 30) {
        out.expired.push({ m, detail: expiryText(m.membershipEnd), vars: base(m) });
      }
      if (m.dob && m.dob.slice(5) === today.slice(5)) {
        out.birthday.push({ m, detail: "Birthday today", vars: base(m) });
      }
      if (st === "active" || st === "expiring") {
        const ref = m.lastVisit || m.membershipStart || today;
        const away = daysBetween(ref, today);
        if (away >= 14) {
          out.inactive.push({
            m,
            detail: m.lastVisit ? `Last visit ${away} days ago` : "Has not visited yet",
            vars: base(m),
          });
        }
      }
    });

    // Dues come from memberships (one row per member, total of all dues)
    const dueMap = new Map<string, number>();
    memberships.forEach((ms) => {
      const due = ms.total - ms.paid;
      if (due > 0 && byId.has(ms.memberId)) {
        dueMap.set(ms.memberId, (dueMap.get(ms.memberId) ?? 0) + due);
      }
    });
    dueMap.forEach((due, id) => {
      const m = byId.get(id)!;
      out.dues.push({
        m,
        detail: `${rupee(due)} due`,
        vars: { ...base(m), due: rupee(due) },
      });
    });

    out.expiring.sort((a, b) => a.m.membershipEnd.localeCompare(b.m.membershipEnd));
    out.expired.sort((a, b) => b.m.membershipEnd.localeCompare(a.m.membershipEnd));
    return out;
  }, [members, memberships, branchId, today, gymName]);

  const sentToday = useMemo(
    () => new Set(logs.filter((l) => l.date === today).map((l) => `${l.segment}:${l.memberId}`)),
    [logs, today]
  );

  const totalDue = rows.dues.reduce(
    (s, r) => s + Number(r.vars.due.replace(/[^\d]/g, "") || 0),
    0
  );

  const isSegment = (t: Tab): t is SegmentKey => SEGMENTS.some((s) => s.key === t);

  const send = (segment: SegmentKey, row: Row, channel: "whatsapp" | "sms") => {
    if (!businessId) return;
    const text = fillTemplate(templates[segment], row.vars);
    const url =
      channel === "whatsapp" ? waWithText(row.m.phone, text) : smsWithText(row.m.phone, text);

    // Open first, so the browser does not block the window
    if (channel === "whatsapp") window.open(url, "_blank", "noopener");
    else window.location.href = url;

    addDoc(collection(db, "businesses", businessId, "messageLogs"), {
      memberId: row.m.id,
      memberName: row.m.name,
      phone: row.m.phone,
      segment,
      channel,
      by: actor,
      date: today,
      createdAt: serverTimestamp(),
    }).catch(() => {
      /* logging must never stop the message */
    });
  };

  const sendNext = (segment: SegmentKey) => {
    const next = rows[segment].find((r) => !sentToday.has(`${segment}:${r.m.id}`));
    if (next) send(segment, next, "whatsapp");
  };

  const saveTemplates = async () => {
    if (!businessId) return;
    setSaving(true);
    setSaved(false);
    try {
      await setDoc(doc(db, "businesses", businessId, "meta", "templates"), draft, {
        merge: true,
      });
      setSaved(true);
    } catch {
      setError("Could not save templates. Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    { label: "Expiring in 7 Days", value: String(rows.expiring.length), sub: "Renewal reminders", icon: CalendarClock },
    { label: "Dues Pending", value: rupee(totalDue), sub: `${rows.dues.length} member(s)`, icon: Wallet },
    { label: "Birthdays Today", value: String(rows.birthday.length), sub: "Send a wish", icon: Cake },
    {
      label: "Messages Today",
      value: String(logs.filter((l) => l.date === today).length),
      sub: "Sent from this panel",
      icon: Send,
    },
  ];

  if (!loaded.members || !loaded.memberships) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  const activeSegment = isSegment(tab) ? SEGMENTS.find((s) => s.key === tab)! : null;
  const list = isSegment(tab) ? rows[tab] : [];
  const unsent = isSegment(tab)
    ? list.filter((r) => !sentToday.has(`${tab}:${r.m.id}`)).length
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Business</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          Notifications & <span className="gold-text">CRM</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Send renewal reminders, due alerts and birthday wishes on WhatsApp or SMS in one click.
        </p>
      </div>

      {error && <p className="card p-5 text-center text-sm text-red-700">{error}</p>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label: l, value, sub, icon: Icon }, i) => {
          const dark = i === 0;
          return (
            <div
              key={l}
              className={`rounded-2xl p-6 transition hover:-translate-y-1 ${
                dark
                  ? "border border-gold/40 bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] text-white shadow-xl shadow-black/25"
                  : "card hover:border-gold/40"
              }`}
            >
              <div
                className={`grid h-11 w-11 place-items-center rounded-xl border ${
                  dark
                    ? "border-gold/30 bg-gold/15 text-gold-light"
                    : "border-gold/25 bg-gold/10 text-gold-soft"
                }`}
              >
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <p className={`mt-6 font-display text-3xl font-semibold ${dark ? "text-gold-light" : ""}`}>
                {value}
              </p>
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-charcoal"}`}>{l}</p>
              <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>{sub}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={`rounded-lg border px-4 py-2 text-sm transition ${
              tab === s.key
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-line text-muted hover:text-charcoal"
            }`}
          >
            {s.label} <span className="text-xs opacity-70">({rows[s.key].length})</span>
          </button>
        ))}
        <button
          onClick={() => setTab("templates")}
          className={`rounded-lg border px-4 py-2 text-sm transition ${
            tab === "templates"
              ? "border-gold/50 bg-gold/15 text-gold-soft"
              : "border-line text-muted hover:text-charcoal"
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm transition ${
            tab === "history"
              ? "border-gold/50 bg-gold/15 text-gold-soft"
              : "border-line text-muted hover:text-charcoal"
          }`}
        >
          <History size={14} /> History
        </button>
      </div>

      {/* Segment list */}
      {activeSegment && isSegment(tab) && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
            <div>
              <h3 className="font-display text-xl">{activeSegment.label}</h3>
              <p className="text-sm text-muted">
                {list.length} member(s) · {unsent} not messaged today
              </p>
            </div>
            <button
              onClick={() => sendNext(tab)}
              disabled={unsent === 0}
              className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm disabled:cursor-not-allowed"
            >
              <Send size={15} /> Send next on WhatsApp
            </button>
          </div>

          {list.length === 0 ? (
            <div className="grid place-items-center px-6 pb-12 pt-4 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <activeSegment.icon size={24} />
              </div>
              <p className="mt-4 text-sm text-muted">{activeSegment.empty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                    <th className="px-6 py-3 font-medium">Member</th>
                    <th className="px-6 py-3 font-medium">Detail</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Send</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => {
                    const done = sentToday.has(`${tab}:${r.m.id}`);
                    return (
                      <tr key={r.m.id} className="border-b border-line/60 last:border-0">
                        <td className="px-6 py-3">
                          <p className="font-medium">{r.m.name}</p>
                          <p className="text-xs text-muted">
                            {r.m.phone} · {r.m.code}
                          </p>
                        </td>
                        <td className="px-6 py-3 text-muted">{r.detail}</td>
                        <td className="px-6 py-3">
                          {done ? (
                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700">
                              Sent today
                            </span>
                          ) : (
                            <span className="text-xs text-muted">Not sent</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              title="WhatsApp"
                              onClick={() => send(tab, r, "whatsapp")}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/20"
                            >
                              <MessageCircle size={13} /> WhatsApp
                            </button>
                            <button
                              title="SMS"
                              onClick={() => send(tab, r, "sms")}
                              className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-500/20"
                            >
                              <MessageSquare size={13} /> SMS
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Templates */}
      {tab === "templates" && (
        <div className="card p-6">
          <h3 className="font-display text-xl">Message Templates</h3>
          <p className="mt-1 text-sm text-muted">
            Use these variables and they fill in automatically:{" "}
            {VARIABLES.map((v) => (
              <code key={v} className="mr-1.5 rounded bg-gold/15 px-1.5 py-0.5 text-xs text-gold-soft">
                {v}
              </code>
            ))}
          </p>

          <div className="mt-6 space-y-5">
            {SEGMENTS.map((s) => (
              <div key={s.key}>
                <label className={label}>{s.label}</label>
                <textarea
                  rows={3}
                  className="input-lux resize-none !pl-4"
                  value={draft[s.key]}
                  onChange={(e) => {
                    setSaved(false);
                    setDraft((d) => ({ ...d, [s.key]: e.target.value }));
                  }}
                />
              </div>
            ))}
          </div>

          {saved && (
            <p className="mt-5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              Templates saved.
            </p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => {
                setDraft(DEFAULT_TEMPLATES);
                setSaved(false);
              }}
              className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:text-charcoal"
            >
              Reset to default
            </button>
            <button
              onClick={saveTemplates}
              disabled={saving}
              className="btn-gold flex items-center gap-2 px-6 py-2.5 text-sm"
            >
              <Save size={16} /> {saving ? "Saving..." : "Save Templates"}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="card overflow-hidden">
          <div className="p-6 pb-4">
            <h3 className="font-display text-xl">Message History</h3>
            <p className="text-sm text-muted">Latest 200 messages sent from this panel</p>
          </div>
          {logs.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted">No messages sent yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                    <th className="px-6 py-3 font-medium">When</th>
                    <th className="px-6 py-3 font-medium">Member</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Channel</th>
                    <th className="px-6 py-3 font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b border-line/60 last:border-0">
                      <td className="whitespace-nowrap px-6 py-3 text-muted">{when(l)}</td>
                      <td className="px-6 py-3">
                        <p className="font-medium">{l.memberName}</p>
                        <p className="text-xs text-muted">{l.phone}</p>
                      </td>
                      <td className="px-6 py-3 text-muted">
                        {SEGMENTS.find((s) => s.key === l.segment)?.label ?? l.segment}
                      </td>
                      <td className="px-6 py-3 capitalize text-muted">{l.channel}</td>
                      <td className="px-6 py-3 text-muted">{l.by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
