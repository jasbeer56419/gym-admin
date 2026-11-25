import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Dumbbell,
  IndianRupee,
  LogIn,
  MessageCircle,
  Repeat,
  Target,
  TrendingUp,
  Undo2,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { db } from "../../firebase";
import type {
  AttendanceRecord,
  Lead,
  Member,
  MemberPayment,
  Membership,
  StaffMember,
} from "../../types";
import { useOwner } from "../OwnerContext";
import { LEAD_STATUS, waLink } from "../leadUtils";
import {
  addDays,
  addMonths,
  daysBetween,
  fmtDate,
  fmtDuration,
  memberStatus,
  parseDate,
  rupee,
  statusMeta,
  toStr,
  todayStr,
} from "../utils";

type Tab = "revenue" | "members" | "attendance" | "leads" | "trainers";
type Range = 30 | 90 | 180 | 365;

const TABS: { key: Tab; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "members", label: "Members" },
  { key: "attendance", label: "Attendance" },
  { key: "leads", label: "Leads" },
  { key: "trainers", label: "Trainers" },
];

const RANGES: { key: Range; label: string }[] = [
  { key: 30, label: "Last 30 days" },
  { key: 90, label: "Last 90 days" },
  { key: 180, label: "Last 6 months" },
  { key: 365, label: "Last 12 months" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LEAD_ORDER = ["new", "contacted", "trial", "negotiation", "converted", "lost"] as const;

// ---------- helpers ----------

type Bucket = { label: string; from: string; to: string };

const shortDay = (s: string) =>
  parseDate(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

const monthLabel = (s: string) =>
  parseDate(s).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

// Daily buckets for 30 days, weekly for 90, monthly for 6 and 12 months
const buildBuckets = (from: string, today: string, range: Range): Bucket[] => {
  const out: Bucket[] = [];
  if (range <= 30) {
    for (let d = from; d <= today; d = addDays(d, 1)) {
      out.push({ label: shortDay(d), from: d, to: d });
    }
  } else if (range <= 90) {
    for (let s = from; s <= today; s = addDays(s, 7)) {
      const e = addDays(s, 6);
      out.push({ label: shortDay(s), from: s, to: e > today ? today : e });
    }
  } else {
    let cur = `${from.slice(0, 7)}-01`;
    while (cur <= today) {
      const next = addMonths(cur, 1);
      const last = addDays(next, -1);
      out.push({
        label: monthLabel(cur),
        from: cur < from ? from : cur,
        to: last > today ? today : last,
      });
      cur = next;
    }
  }
  return out;
};

const inBucket = (date: string, b: Bucket) => date >= b.from && date <= b.to;

const dayOf = (ts: { toDate: () => Date } | null | undefined, fallback: string) =>
  ts ? toStr(ts.toDate()) : fallback;

const net = (p: MemberPayment) => p.amount - (p.refundedAmount ?? 0);

const toRows = (map: Record<string, number>) =>
  Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

const hourLabel = (h: number) => `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;

const compact = (n: number) => (n >= 100000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n));

const toCsv = (header: string[], rows: (string | number)[][]) =>
  [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

const download = (filename: string, csv: string) => {
  // The first character helps Excel read the file correctly
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid rgba(201,162,39,0.4)",
  borderRadius: 12,
  color: "#17151f",
};

// ---------- small UI pieces ----------

type CardData = { label: string; value: string; sub: string; icon: LucideIcon };

function Cards({ cards }: { cards: CardData[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, sub, icon: Icon }, i) => {
        const dark = i === 0;
        return (
          <div
            key={label}
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
            <p
              className={`mt-6 font-display text-3xl font-semibold ${
                dark ? "text-gold-light" : ""
              }`}
            >
              {value}
            </p>
            <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-charcoal"}`}>{label}</p>
            <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>{sub}</p>
          </div>
        );
      })}
    </div>
  );
}

function Panel({
  title,
  sub,
  className = "",
  children,
}: {
  title: string;
  sub?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`card p-6 ${className}`}>
      <h3 className="font-display text-xl">{title}</h3>
      {sub && <p className="text-sm text-muted">{sub}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Trend({
  data,
  name,
  format = String,
  tick,
}: {
  data: { label: string; v: number }[];
  name: string;
  format?: (n: number) => string;
  tick?: (n: number) => string;
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(40,30,10,0.07)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#7a7466"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#7a7466"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickFormatter={tick}
          />
          <Tooltip
            formatter={(v) => [format(Number(v)), name]}
            contentStyle={tooltipStyle}
          />
          <Bar dataKey="v" fill="#c9a227" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Split({
  rows,
  fmt,
  empty = "No data for this period.",
}: {
  rows: { name: string; value: number }[];
  fmt: (n: number) => string;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-5">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">{r.name}</span>
            <span className="text-muted">{fmt(r.value)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gold/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- page ----------

export default function Reports() {
  const { businessId, branches, branchId } = useOwner();

  const [tab, setTab] = useState<Tab>("revenue");
  const [range, setRange] = useState<Range>(30);

  const [payments, setPayments] = useState<MemberPayment[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [visits, setVisits] = useState<AttendanceRecord[]>([]);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  const today = todayStr();
  const from = addDays(today, -(range - 1));

  useEffect(() => {
    if (!businessId) return;
    const mark = (k: string) => setReady((r) => ({ ...r, [k]: true }));
    const fail = (k: string) => () => {
      setError("Could not load some report data. Please try again.");
      mark(k);
    };
    const sub = <T,>(name: string, set: (v: T[]) => void) =>
      onSnapshot(
        collection(db, "businesses", businessId, name),
        (snap) => {
          set(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
          mark(name);
        },
        fail(name)
      );

    const unsubs = [
      sub<MemberPayment>("payments", setPayments),
      sub<Membership>("memberships", setMemberships),
      sub<Member>("members", setMembers),
      sub<Lead>("leads", setLeads),
      sub<StaffMember>("staff", setStaff),
    ];
    return () => unsubs.forEach((u) => u());
  }, [businessId]);

  // Attendance is only loaded for the selected range
  useEffect(() => {
    if (!businessId) return;
    return onSnapshot(
      query(collection(db, "businesses", businessId, "attendance"), where("date", ">=", from)),
      (snap) => {
        setVisits(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord));
        setReady((r) => ({ ...r, attendance: true }));
      },
      () => {
        setError("Could not load attendance data. Please try again.");
        setReady((r) => ({ ...r, attendance: true }));
      }
    );
  }, [businessId, from]);

  const loading = !(
    ready.payments &&
    ready.memberships &&
    ready.members &&
    ready.leads &&
    ready.staff &&
    ready.attendance
  );

  const inBranch = <T extends { branchId: string }>(x: T) =>
    branchId === "all" || x.branchId === branchId;

  const buckets = useMemo(() => buildBuckets(from, today, range), [from, today, range]);

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "Unknown";

  // ----- Revenue -----
  const revenue = useMemo(() => {
    const list = payments
      .filter(inBranch)
      .filter((p) => p.date >= from && p.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date));

    const gross = list.reduce((s, p) => s + p.amount, 0);
    const refunded = list.reduce((s, p) => s + (p.refundedAmount ?? 0), 0);
    const collected = gross - refunded;

    const trend = buckets.map((b) => ({
      label: b.label,
      v: list.filter((p) => inBucket(p.date, b)).reduce((s, p) => s + net(p), 0),
    }));

    const add = (map: Record<string, number>, key: string, v: number) => {
      map[key] = (map[key] ?? 0) + v;
    };
    const methods: Record<string, number> = {};
    const plans: Record<string, number> = {};
    const byBranch: Record<string, number> = {};
    list.forEach((p) => {
      add(methods, p.method, net(p));
      add(plans, p.planName || "Other", net(p));
      add(byBranch, branchName(p.branchId), net(p));
    });

    const ms = memberships.filter(inBranch);
    const dueList = ms.filter((m) => m.total - m.paid > 0);

    return {
      list,
      collected,
      gross,
      refunded,
      avg: list.length === 0 ? 0 : Math.round(gross / list.length),
      trend,
      methods: toRows(methods),
      plans: toRows(plans),
      branches: toRows(byBranch),
      dues: dueList.reduce((s, m) => s + (m.total - m.paid), 0),
      overdue: dueList
        .filter((m) => m.endDate < today)
        .reduce((s, m) => s + (m.total - m.paid), 0),
      dueCount: dueList.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, memberships, buckets, from, today, branchId, branches]);

  // ----- Members -----
  const memberStats = useMemo(() => {
    const live = members.filter(inBranch).filter((m) => !m.archived);
    const created = (m: Member) => dayOf(m.createdAt, today);
    const fresh = live.filter((m) => created(m) >= from && created(m) <= today);

    const growth = buckets.map((b) => ({
      label: b.label,
      v: fresh.filter((m) => inBucket(created(m), b)).length,
    }));

    const status: Record<string, number> = {};
    live.forEach((m) => {
      const label = statusMeta[memberStatus(m)].label;
      status[label] = (status[label] ?? 0) + 1;
    });

    const sources: Record<string, number> = {};
    fresh.forEach((m) => {
      const k = m.source || "Other";
      sources[k] = (sources[k] ?? 0) + 1;
    });

    const planDist: Record<string, number> = {};
    live.forEach((m) => {
      if (m.membershipPlan) planDist[m.membershipPlan] = (planDist[m.membershipPlan] ?? 0) + 1;
    });

    // Memberships that ended in this period, and how many were renewed later
    const due = memberships
      .filter(inBranch)
      .filter((ms) => ms.status !== "replaced" && ms.endDate >= from && ms.endDate <= today);
    const renewedOf = (ms: Membership) =>
      memberships.some(
        (x) => x.memberId === ms.memberId && x.id !== ms.id && x.startDate > ms.startDate
      );
    const renewed = due.filter(renewedOf);
    const byId = new Map(members.map((m) => [m.id, m]));
    const lapsed = due
      .filter((ms) => !renewedOf(ms))
      .map((ms) => ({ ms, m: byId.get(ms.memberId) }))
      .filter((x): x is { ms: Membership; m: Member } => !!x.m && !x.m.archived)
      .sort((a, b) => b.ms.endDate.localeCompare(a.ms.endDate));

    return {
      live,
      fresh,
      growth,
      status: toRows(status),
      sources: toRows(sources),
      planDist: toRows(planDist),
      activeNow: live.filter((m) => ["active", "expiring"].includes(memberStatus(m))).length,
      dueCount: due.length,
      renewedCount: renewed.length,
      rate: due.length === 0 ? null : Math.round((renewed.length / due.length) * 100),
      lapsed,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, memberships, buckets, from, today, branchId]);

  // ----- Attendance -----
  const att = useMemo(() => {
    const list = visits.filter(inBranch).filter((v) => v.date <= today);
    const closed = list.filter((v) => v.checkInAt && v.checkOutAt);
    const avgStay =
      closed.length === 0
        ? null
        : Math.round(
            closed.reduce((s, v) => s + (v.checkOutAt!.seconds - v.checkInAt!.seconds) / 60, 0) /
              closed.length
          );

    const hours = Array<number>(24).fill(0);
    const weekdays = Array<number>(7).fill(0);
    const perMember = new Map<string, { name: string; code: string; n: number }>();
    list.forEach((v) => {
      const h = v.checkInAt?.toDate().getHours();
      if (h !== undefined) hours[h]++;
      weekdays[(parseDate(v.date).getDay() + 6) % 7]++;
      const cur = perMember.get(v.memberId);
      if (cur) cur.n++;
      else perMember.set(v.memberId, { name: v.memberName, code: v.memberCode, n: 1 });
    });

    const hourly = Array.from({ length: 19 }, (_, i) => ({
      label: hourLabel(i + 5),
      v: hours[i + 5],
    }));
    const peak = hourly.reduce((b, x) => (x.v > b.v ? x : b), hourly[0]);
    const busiestDay = weekdays.indexOf(Math.max(...weekdays));

    return {
      list,
      visits: list.length,
      unique: new Set(list.map((v) => v.memberId)).size,
      perDay: Math.round((list.length / range) * 10) / 10,
      avgStay,
      overrides: list.filter((v) => v.override).length,
      trend: buckets.map((b) => ({
        label: b.label,
        v: list.filter((v) => inBucket(v.date, b)).length,
      })),
      hourly,
      peak,
      weekdayRows: WEEKDAYS.map((d, i) => ({ label: d, v: weekdays[i] })),
      busiestDay: list.length === 0 ? "" : WEEKDAYS[busiestDay],
      top: [...perMember.entries()]
        .map(([id, x]) => ({ id, ...x }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 10),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, buckets, range, today, branchId]);

  // ----- Leads -----
  const leadStats = useMemo(() => {
    const created = (l: Lead) => dayOf(l.createdAt, today);
    const list = leads
      .filter(inBranch)
      .filter((l) => created(l) >= from && created(l) <= today);
    const converted = list.filter((l) => l.status === "converted");

    const funnel = LEAD_ORDER.map((s) => ({
      name: LEAD_STATUS[s].label,
      value: list.filter((l) => l.status === s).length,
    }));

    const bySource: Record<string, { total: number; won: number }> = {};
    list.forEach((l) => {
      const k = l.source || "Other";
      bySource[k] ??= { total: 0, won: 0 };
      bySource[k].total++;
      if (l.status === "converted") bySource[k].won++;
    });

    const reasons: Record<string, number> = {};
    list
      .filter((l) => l.status === "lost" && l.lostReason)
      .forEach((l) => {
        const k = l.lostReason.trim().toLowerCase();
        reasons[k] = (reasons[k] ?? 0) + 1;
      });

    const days = converted
      .filter((l) => l.convertedOn)
      .map((l) => Math.max(0, daysBetween(created(l), l.convertedOn)));

    return {
      list,
      total: list.length,
      converted: converted.length,
      rate: list.length === 0 ? 0 : Math.round((converted.length / list.length) * 100),
      avgDays:
        days.length === 0 ? null : Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10,
      funnel,
      sources: Object.entries(bySource)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.total - a.total),
      reasons: toRows(reasons).slice(0, 6),
      trend: buckets.map((b) => ({
        label: b.label,
        v: list.filter((l) => inBucket(created(l), b)).length,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, buckets, from, today, branchId]);

  // ----- Trainers -----
  const trainerStats = useMemo(() => {
    const live = members.filter((m) => !m.archived);
    const rows = staff
      .filter((s) => s.role === "trainer")
      .map((t) => {
        const mine = live.filter((m) => m.trainerId === t.id);
        const st = mine.map(memberStatus);
        return {
          id: t.id,
          name: t.name,
          disabled: t.status === "disabled",
          total: mine.length,
          active: st.filter((s) => s === "active" || s === "expiring").length,
          expiring: st.filter((s) => s === "expiring").length,
          away: mine.filter(
            (m) =>
              ["active", "expiring"].includes(memberStatus(m)) &&
              daysBetween(m.lastVisit || m.membershipStart || today, today) >= 14
          ).length,
        };
      })
      .sort((a, b) => b.total - a.total);
    const unassigned = live.filter(
      (m) => !m.trainerId && ["active", "expiring"].includes(memberStatus(m))
    ).length;
    return {
      rows,
      unassigned,
      assigned: rows.reduce((s, r) => s + r.total, 0),
      active: rows.reduce((s, r) => s + r.active, 0),
      away: rows.reduce((s, r) => s + r.away, 0),
    };
  }, [members, staff, today]);

  // ----- CSV export -----
  const exportCsv = () => {
    const stamp = `${from}_to_${today}`;
    if (tab === "revenue") {
      download(
        `revenue-${stamp}.csv`,
        toCsv(
          ["Invoice", "Date", "Member", "Plan", "Branch", "Method", "Type", "Amount", "Refunded", "Net"],
          revenue.list.map((p) => [
            p.invoiceNo,
            p.date,
            p.memberName,
            p.planName,
            branchName(p.branchId),
            p.method,
            p.type === "due" ? "Balance payment" : "Membership",
            p.amount,
            p.refundedAmount ?? 0,
            net(p),
          ])
        )
      );
    } else if (tab === "members") {
      download(
        `members-${today}.csv`,
        toCsv(
          ["Code", "Name", "Phone", "Branch", "Plan", "Ends", "Status", "Joined"],
          memberStats.live.map((m) => [
            m.code,
            m.name,
            m.phone,
            m.branchName,
            m.membershipPlan,
            m.membershipEnd,
            statusMeta[memberStatus(m)].label,
            dayOf(m.createdAt, today),
          ])
        )
      );
    } else if (tab === "attendance") {
      download(
        `attendance-${stamp}.csv`,
        toCsv(
          ["Date", "Member", "Code", "Branch", "Check-in", "Check-out", "Entry"],
          att.list
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((v) => [
              v.date,
              v.memberName,
              v.memberCode,
              v.branchName,
              v.checkInAt ? v.checkInAt.toDate().toLocaleTimeString("en-IN") : "",
              v.checkOutAt ? v.checkOutAt.toDate().toLocaleTimeString("en-IN") : "",
              v.override ? `Override: ${v.overrideReason}` : "Valid",
            ])
        )
      );
    } else if (tab === "leads") {
      download(
        `leads-${stamp}.csv`,
        toCsv(
          ["Name", "Phone", "Source", "Interest", "Branch", "Status", "Next follow-up", "Lost reason"],
          leadStats.list.map((l) => [
            l.name,
            l.phone,
            l.source,
            l.interest,
            l.branchName,
            LEAD_STATUS[l.status].label,
            l.nextFollowUp,
            l.lostReason,
          ])
        )
      );
    } else {
      download(
        `trainers-${today}.csv`,
        toCsv(
          ["Trainer", "Members", "Active", "Expiring", "Not seen 14+ days"],
          trainerStats.rows.map((r) => [r.name, r.total, r.active, r.expiring, r.away])
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  const dateRange = `${fmtDate(from)} to ${fmtDate(today)}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Business</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Reports & <span className="gold-text">Analytics</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            {dateRange}
            {branchId === "all" ? " · all branches" : ` · ${branchName(branchId)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value) as Range)}
            className="input-lux !w-auto !py-2.5 !pl-4 text-sm"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm text-muted transition hover:border-gold/50 hover:text-charcoal"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {error && <p className="card p-5 text-center text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg border px-4 py-2 text-sm transition ${
              tab === t.key
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-line text-muted hover:text-charcoal"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- Revenue ---------------- */}
      {tab === "revenue" && (
        <>
          <Cards
            cards={[
              {
                label: "Net Collected",
                value: rupee(revenue.collected),
                sub: `${revenue.list.length} payment${revenue.list.length === 1 ? "" : "s"}, after refunds`,
                icon: Wallet,
              },
              {
                label: "Average Payment",
                value: rupee(revenue.avg),
                sub: "Before refunds",
                icon: IndianRupee,
              },
              {
                label: "Refunded",
                value: rupee(revenue.refunded),
                sub: "On payments in this period",
                icon: Undo2,
              },
              {
                label: "Outstanding Dues",
                value: rupee(revenue.dues),
                sub: `${revenue.dueCount} membership(s) · ${rupee(revenue.overdue)} overdue`,
                icon: Clock,
              },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <Panel
              title="Collections"
              sub={range <= 30 ? "Per day" : range <= 90 ? "Per week" : "Per month"}
              className="xl:col-span-2"
            >
              <Trend data={revenue.trend} name="Collected" format={rupee} tick={compact} />
            </Panel>
            <Panel title="Payment Methods" sub="Net collected">
              <Split rows={revenue.methods} fmt={rupee} />
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Revenue by Plan" sub="Which memberships earn the most">
              <Split rows={revenue.plans} fmt={rupee} />
            </Panel>
            {branchId === "all" && branches.length > 1 ? (
              <Panel title="Revenue by Branch" sub="Net collected">
                <Split rows={revenue.branches} fmt={rupee} />
              </Panel>
            ) : (
              <Panel title="How this is calculated">
                <p className="text-sm text-muted">
                  Each payment is counted on the date it was received. A refund is subtracted from
                  the payment it belongs to, so the net amount always matches the Billing page.
                  Outstanding dues are a live balance and do not depend on the selected period.
                </p>
              </Panel>
            )}
          </div>
        </>
      )}

      {/* ---------------- Members ---------------- */}
      {tab === "members" && (
        <>
          <Cards
            cards={[
              {
                label: "New Members",
                value: String(memberStats.fresh.length),
                sub: "Registered in this period",
                icon: UserPlus,
              },
              {
                label: "Active Now",
                value: String(memberStats.activeNow),
                sub: `${memberStats.live.length} total members`,
                icon: Users,
              },
              {
                label: "Renewal Rate",
                value: memberStats.rate === null ? "—" : `${memberStats.rate}%`,
                sub: `${memberStats.renewedCount} of ${memberStats.dueCount} ended memberships renewed`,
                icon: Repeat,
              },
              {
                label: "Not Renewed",
                value: String(memberStats.lapsed.length),
                sub: "Ended in this period, no renewal",
                icon: UserMinus,
              },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <Panel
              title="New Members"
              sub={range <= 30 ? "Per day" : range <= 90 ? "Per week" : "Per month"}
              className="xl:col-span-2"
            >
              <Trend data={memberStats.growth} name="New members" />
            </Panel>
            <Panel title="Member Status" sub="Right now">
              <Split rows={memberStats.status} fmt={(n) => `${n}`} />
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Where New Members Come From" sub="By source">
              <Split
                rows={memberStats.sources}
                fmt={(n) => `${n}`}
                empty="No new members in this period."
              />
            </Panel>
            <Panel title="Members by Plan" sub="Current memberships">
              <Split rows={memberStats.planDist} fmt={(n) => `${n}`} empty="No memberships yet." />
            </Panel>
          </div>

          <div className="card overflow-hidden">
            <div className="p-6 pb-4">
              <h3 className="font-display text-xl">Win-back List</h3>
              <p className="text-sm text-muted">
                Memberships that ended in this period and were not renewed (latest 10)
              </p>
            </div>
            {memberStats.lapsed.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">Nobody to follow up. Nice work!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                      <th className="px-6 py-3 font-medium">Member</th>
                      <th className="px-6 py-3 font-medium">Plan</th>
                      <th className="px-6 py-3 font-medium">Ended</th>
                      <th className="px-6 py-3 text-right font-medium">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberStats.lapsed.slice(0, 10).map(({ ms, m }) => (
                      <tr key={ms.id} className="border-b border-line/60 last:border-0">
                        <td className="px-6 py-3">
                          <Link to={`/app/members/${m.id}`} className="font-medium hover:underline">
                            {m.name}
                          </Link>
                          <p className="text-xs text-muted">{m.phone}</p>
                        </td>
                        <td className="px-6 py-3 text-muted">{ms.planName}</td>
                        <td className="px-6 py-3 text-muted">{fmtDate(ms.endDate)}</td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end">
                            <a
                              href={waLink(m.phone)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/20"
                            >
                              <MessageCircle size={13} /> WhatsApp
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ---------------- Attendance ---------------- */}
      {tab === "attendance" && (
        <>
          <Cards
            cards={[
              {
                label: "Total Check-ins",
                value: String(att.visits),
                sub: att.overrides > 0 ? `${att.overrides} manual override(s)` : "No overrides",
                icon: LogIn,
              },
              {
                label: "Unique Members",
                value: String(att.unique),
                sub: "Visited at least once",
                icon: Users,
              },
              {
                label: "Average per Day",
                value: String(att.perDay),
                sub: att.busiestDay ? `Busiest day: ${att.busiestDay}` : "No visits yet",
                icon: TrendingUp,
              },
              {
                label: "Average Stay",
                value: att.avgStay === null ? "—" : fmtDuration(att.avgStay),
                sub: "Per completed visit",
                icon: Clock,
              },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <Panel
              title="Check-ins"
              sub={range <= 30 ? "Per day" : range <= 90 ? "Per week" : "Per month"}
              className="xl:col-span-2"
            >
              <Trend data={att.trend} name="Check-ins" />
            </Panel>
            <Panel title="Busiest Weekdays">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={att.weekdayRows}>
                    <CartesianGrid stroke="rgba(40,30,10,0.07)" vertical={false} />
                    <XAxis dataKey="label" stroke="#7a7466" tickLine={false} axisLine={false} />
                    <YAxis stroke="#7a7466" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, "Check-ins"]} contentStyle={tooltipStyle} />
                    <Bar dataKey="v" fill="#c9a227" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Panel
              title="Check-ins by Hour"
              sub={
                att.peak && att.peak.v > 0
                  ? `Busiest time: ${att.peak.label} (${att.peak.v} check-ins)`
                  : "No check-ins in this period."
              }
              className="xl:col-span-2"
            >
              <Trend data={att.hourly} name="Check-ins" />
            </Panel>
            <Panel title="Most Regular Members" sub="By number of visits">
              {att.top.length === 0 ? (
                <p className="text-sm text-muted">No visits in this period.</p>
              ) : (
                <div className="space-y-3">
                  {att.top.map((t, i) => (
                    <Link
                      key={t.id}
                      to={`/app/members/${t.id}`}
                      className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3 transition hover:border-gold/40"
                    >
                      <span className="w-5 text-sm text-muted">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted">{t.code}</p>
                      </div>
                      <span className="rounded-full bg-gold/15 px-2.5 py-1 text-xs text-gold-soft">
                        {t.n} visits
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      {/* ---------------- Leads ---------------- */}
      {tab === "leads" && (
        <>
          <Cards
            cards={[
              {
                label: "New Leads",
                value: String(leadStats.total),
                sub: "Enquiries in this period",
                icon: Target,
              },
              {
                label: "Converted",
                value: String(leadStats.converted),
                sub: "Became members",
                icon: CheckCircle2,
              },
              {
                label: "Conversion Rate",
                value: `${leadStats.rate}%`,
                sub: "Converted out of new leads",
                icon: TrendingUp,
              },
              {
                label: "Days to Convert",
                value: leadStats.avgDays === null ? "—" : String(leadStats.avgDays),
                sub: "Average from enquiry to member",
                icon: Clock,
              },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <Panel
              title="Enquiries"
              sub={range <= 30 ? "Per day" : range <= 90 ? "Per week" : "Per month"}
              className="xl:col-span-2"
            >
              <Trend data={leadStats.trend} name="New leads" />
            </Panel>
            <Panel title="Pipeline" sub="Where these leads are now">
              <Split rows={leadStats.funnel} fmt={(n) => `${n}`} />
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="card overflow-hidden xl:col-span-2">
              <div className="p-6 pb-4">
                <h3 className="font-display text-xl">Conversion by Source</h3>
                <p className="text-sm text-muted">Which channels bring members, not just enquiries</p>
              </div>
              {leadStats.sources.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted">No leads in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                        <th className="px-6 py-3 font-medium">Source</th>
                        <th className="px-6 py-3 font-medium">Leads</th>
                        <th className="px-6 py-3 font-medium">Converted</th>
                        <th className="px-6 py-3 font-medium">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadStats.sources.map((s) => (
                        <tr key={s.name} className="border-b border-line/60 last:border-0">
                          <td className="px-6 py-3 font-medium">{s.name}</td>
                          <td className="px-6 py-3">{s.total}</td>
                          <td className="px-6 py-3">{s.won}</td>
                          <td className="px-6 py-3 text-muted">
                            {Math.round((s.won / s.total) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <Panel title="Why Leads Are Lost" sub="Most common reasons">
              <Split
                rows={leadStats.reasons}
                fmt={(n) => `${n}`}
                empty="No lost leads in this period."
              />
            </Panel>
          </div>
        </>
      )}

      {/* ---------------- Trainers ---------------- */}
      {tab === "trainers" && (
        <>
          <Cards
            cards={[
              {
                label: "Trainers",
                value: String(trainerStats.rows.length),
                sub: "On your team",
                icon: Dumbbell,
              },
              {
                label: "Assigned Members",
                value: String(trainerStats.assigned),
                sub: `${trainerStats.unassigned} active member(s) have no trainer`,
                icon: Users,
              },
              {
                label: "Active Under Trainers",
                value: String(trainerStats.active),
                sub: "With a valid membership",
                icon: CheckCircle2,
              },
              {
                label: "Not Seen Lately",
                value: String(trainerStats.away),
                sub: "No visit for 14+ days",
                icon: AlertTriangle,
              },
            ]}
          />

          <div className="card overflow-hidden">
            <div className="p-6 pb-4">
              <h3 className="font-display text-xl">Trainer Workload</h3>
              <p className="text-sm text-muted">Current numbers (not affected by the date range)</p>
            </div>
            {trainerStats.rows.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">
                No trainers yet. Add one from Trainers & Staff.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                      <th className="px-6 py-3 font-medium">Trainer</th>
                      <th className="px-6 py-3 font-medium">Members</th>
                      <th className="px-6 py-3 font-medium">Active</th>
                      <th className="px-6 py-3 font-medium">Expiring in 7 days</th>
                      <th className="px-6 py-3 font-medium">Not seen 14+ days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainerStats.rows.map((r) => (
                      <tr key={r.id} className="border-b border-line/60 last:border-0">
                        <td className="px-6 py-3 font-medium">
                          {r.name}
                          {r.disabled && (
                            <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-700">
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3">{r.total}</td>
                        <td className="px-6 py-3 text-emerald-700">{r.active}</td>
                        <td className="px-6 py-3 text-amber-700">{r.expiring}</td>
                        <td className="px-6 py-3 text-red-600">{r.away}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
