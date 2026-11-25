import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";

   import { ROLE_LABEL, usePermissions } from "../permissions";
   import CollectedBy from "../components/CollectedBy";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Clock,
  CreditCard,
  Download,
  FileText,
  IndianRupee,
  Search,
  Undo2,
  Wallet,
} from "lucide-react";
import { db } from "../../firebase";
import type { MemberPayment, Membership } from "../../types";
import { useOwner } from "../OwnerContext";
import { useSettings } from "../useSettings";
import { addDays, fmtDate, rupee, todayStr } from "../utils";
import CollectPaymentModal from "../components/CollectPaymentModal";
import RefundModal from "../components/RefundModal";
import ReceiptModal from "../components/ReceiptModal";

type Tab = "payments" | "dues";
type Period = "today" | "month" | "30d" | "all";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "month", label: "This month" },
  { key: "30d", label: "Last 30 days" },
  { key: "all", label: "All time" },
];

const METHODS = ["Cash", "UPI", "Card", "Net Banking", "Bank Transfer", "Cheque"];

// What the gym really kept from a payment
const net = (p: MemberPayment) => p.amount - (p.refundedAmount ?? 0);

const payState = (p: MemberPayment) => {
  const r = p.refundedAmount ?? 0;
  if (r <= 0) return { label: "Paid", cls: "bg-emerald-500/10 text-emerald-700" };
  if (r >= p.amount) return { label: "Refunded", cls: "bg-slate-500/10 text-slate-600" };
  return { label: "Partly refunded", cls: "bg-amber-500/10 text-amber-700" };
};

export default function Billing() {
  const { businessId, business, branchId } = useOwner();
  const settings = useSettings(businessId);
    const { can } = usePermissions();

  const [payments, setPayments] = useState<MemberPayment[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loaded, setLoaded] = useState({ payments: false, memberships: false });
  const [error, setError] = useState("");

  const [tab, setTab] = useState<Tab>("payments");
  const [period, setPeriod] = useState<Period>("month");
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
     const [staffFilter, setStaffFilter] = useState("all");

  const [receipt, setReceipt] = useState<MemberPayment | null>(null);
  const [refund, setRefund] = useState<MemberPayment | null>(null);
  const [collect, setCollect] = useState<Membership | null>(null);

  useEffect(() => {
    if (!businessId) return;

    const fail = () => {
      setError("Could not load billing data. Please try again.");
      setLoaded({ payments: true, memberships: true });
    };

    const u1 = onSnapshot(
      collection(db, "businesses", businessId, "payments"),
      (snap) => {
        setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MemberPayment));
        setLoaded((l) => ({ ...l, payments: true }));
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
    return () => {
      u1();
      u2();
    };
  }, [businessId]);

  // Follow the branch switcher in the top bar
  const scopedPayments = useMemo(
    () => payments.filter((p) => branchId === "all" || p.branchId === branchId),
    [payments, branchId]
  );
  const scopedMemberships = useMemo(
    () => memberships.filter((m) => branchId === "all" || m.branchId === branchId),
    [memberships, branchId]
  );

     const collectors = useMemo(() => {
     const map = new Map<string, string>();
     scopedPayments.forEach((p) => {
       if (p.collectedById) map.set(p.collectedById, p.collectedByName || "Unknown");
     });
     return [...map.entries()]
       .map(([id, name]) => ({ id, name }))
       .sort((a, b) => a.name.localeCompare(b.name));
   }, [scopedPayments]);

  const stats = useMemo(() => {
    const today = todayStr();
    const month = today.slice(0, 7);
    const sum = (list: MemberPayment[]) => list.reduce((s, p) => s + net(p), 0);

    return {
      month: sum(scopedPayments.filter((p) => p.date.startsWith(month))),
      today: sum(scopedPayments.filter((p) => p.date === today)),
      refunded: scopedPayments
        .flatMap((p) => p.refunds ?? [])
        .filter((r) => r.date.startsWith(month))
        .reduce((s, r) => s + r.amount, 0),
      dues: scopedMemberships.reduce((s, m) => s + Math.max(0, m.total - m.paid), 0),
    };
  }, [scopedPayments, scopedMemberships]);

  // Last 6 months of collections
  const trend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const v = scopedPayments
        .filter((p) => p.date.startsWith(key))
        .reduce((s, p) => s + net(p), 0);
      return { m: d.toLocaleString("en-IN", { month: "short" }), v };
    });
  }, [scopedPayments]);

  // This month's collections by payment method
  const methodSplit = useMemo(() => {
    const month = todayStr().slice(0, 7);
    const map: Record<string, number> = {};
    scopedPayments
      .filter((p) => p.date.startsWith(month))
      .forEach((p) => {
        map[p.method] = (map[p.method] ?? 0) + net(p);
      });
    const rows = Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const total = rows.reduce((s, r) => s + r.value, 0);
    return { rows, total };
  }, [scopedPayments]);

  const filtered = useMemo(() => {
    const today = todayStr();
    const q = search.trim().toLowerCase();
    const inPeriod = (date: string) => {
      switch (period) {
        case "today":
          return date === today;
        case "month":
          return date.startsWith(today.slice(0, 7));
        case "30d":
          return date >= addDays(today, -29);
        default:
          return true;
      }
    };
    return scopedPayments
      .filter(
        (p) =>
          inPeriod(p.date) &&
          (method === "all" || p.method === method) &&
          (staffFilter === "all" ||
            (staffFilter === "none" ? !p.collectedById : p.collectedById === staffFilter)) &&
          (!q || p.invoiceNo.toLowerCase().includes(q) || p.memberName.toLowerCase().includes(q))
      )
      
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
      );
  }, [scopedPayments, period, method, search, staffFilter]);
  

  const filteredTotal = filtered.reduce((s, p) => s + net(p), 0);
     const byStaff = useMemo(() => {
     const map = new Map<string, { name: string; role: string; count: number; total: number }>();
     filtered.forEach((p) => {
       const key = p.collectedById || "none";
       const row = map.get(key) ?? {
         name: p.collectedByName || "Not recorded",
         role: p.collectedByRole || "",
         count: 0,
         total: 0,
       };
       row.count += 1;
       row.total += net(p);
       map.set(key, row);
     });
     const rows = [...map.entries()]
       .map(([key, v]) => ({ key, ...v }))
       .sort((a, b) => b.total - a.total);
     return { rows, max: Math.max(1, ...rows.map((r) => r.total)) };
   }, [filtered]);

  const dueRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedMemberships
      .filter((m) => m.total - m.paid > 0 && (!q || m.memberName.toLowerCase().includes(q)))
      .sort((a, b) => a.endDate.localeCompare(b.endDate));
  }, [scopedMemberships, search]);

  const exportCsv = () => {
    const header = [
      "Invoice",
      "Date",
      "Member",
      "Plan",
      "Method",
      "collected by",
      "Type",
      "Amount",
      "Refunded",
      "Net",
      "Note",
    ];
    const rows = filtered.map((p) => [
      p.invoiceNo,
      p.date,
      p.memberName,
      p.planName,
      p.method,
      p.collectedByName ?? "",
      p.type === "due" ? "Balance payment" : "Membership",
      p.amount,
      p.refundedAmount ?? 0,
      net(p),
      p.note ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // The first character helps Excel read the file correctly
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    {
      label: "Collected This Month",
      value: rupee(stats.month),
      sub: "After refunds",
      icon: Wallet,
    },
    {
      label: "Collected Today",
      value: rupee(stats.today),
      sub: "Payments received today",
      icon: IndianRupee,
    },
    {
      label: "Outstanding Dues",
      value: rupee(stats.dues),
      sub: `${scopedMemberships.filter((m) => m.total - m.paid > 0).length} membership(s) with balance`,
      icon: Clock,
    },
    {
      label: "Refunded This Month",
      value: rupee(stats.refunded),
      sub: "Returned to members",
      icon: Undo2,
    },
  ];

  if (!loaded.payments || !loaded.memberships) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  const today = todayStr();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Business</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          Billing & <span className="gold-text">Payments</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Track every payment, collect pending dues, issue refunds and print receipts.
        </p>
      </div>

      {error && <p className="card p-5 text-center text-sm text-red-700">{error}</p>}

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
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-charcoal"}`}>
                {label}
              </p>
              <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>
                {sub}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="card p-6 xl:col-span-2">
          <h3 className="font-display text-xl">Monthly Collections</h3>
          <p className="text-sm text-muted">Last 6 months, after refunds</p>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9a227" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#c9a227" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(40,30,10,0.07)" vertical={false} />
                <XAxis dataKey="m" stroke="#7a7466" tickLine={false} axisLine={false} />
                <YAxis stroke="#7a7466" tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v) => [rupee(Number(v)), "Collected"]}
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid rgba(201,162,39,0.4)",
                    borderRadius: 12,
                    color: "#17151f",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#b8902c"
                  strokeWidth={2.5}
                  fill="url(#goldFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display text-xl">Payment Methods</h3>
          <p className="text-sm text-muted">This month</p>
          {methodSplit.rows.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No payments this month yet.</p>
          ) : (
            <div className="mt-6 space-y-5">
              {methodSplit.rows.map((r) => (
                <div key={r.name}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted">{rupee(r.value)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gold/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
                      style={{
                        width: `${methodSplit.total > 0 ? (r.value / methodSplit.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

         <div className="card p-6">
     <h3 className="font-display text-xl">Collected by Staff</h3>
     <p className="text-sm text-muted">
       Follows the period, method and staff filters of the Payments list. Amounts are after refunds.
     </p>
     {byStaff.rows.length === 0 ? (
       <p className="mt-6 text-sm text-muted">No payments in this selection.</p>
     ) : (
       <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
         {byStaff.rows.map((r) => (
           <button
             key={r.key}
             onClick={() => setStaffFilter(r.key)}
             className="rounded-xl border border-line bg-white/60 p-4 text-left transition hover:border-gold/40"
           >
             <div className="flex items-center gap-3">
               <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold text-sm font-semibold text-charcoal">
                 {r.name[0]?.toUpperCase()}
               </div>
               <div className="min-w-0 flex-1">
                 <p className="truncate text-sm font-medium">{r.name}</p>
                 <p className="text-xs text-muted">
                   {r.role ? (ROLE_LABEL[r.role] ?? r.role) : "Older payments"} · {r.count} payment
                   {r.count === 1 ? "" : "s"}
                 </p>
               </div>
               <p className="font-display text-lg font-semibold">{rupee(r.total)}</p>
             </div>
             <div className="mt-3 h-2 overflow-hidden rounded-full bg-gold/10">
               <div
                 className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
                 style={{ width: `${(r.total / byStaff.max) * 100}%` }}
               />
             </div>
           </button>
         ))}
       </div>
     )}
   </div>

      <div className="card overflow-hidden">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 pt-4">
          {(
            [
              { key: "payments", label: `Payments (${filtered.length})` },
              { key: "dues", label: `Dues (${dueRows.length})` },
            ] as { key: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm transition ${
                tab === t.key
                  ? "border-gold font-medium text-gold-soft"
                  : "border-transparent text-muted hover:text-charcoal"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              placeholder={
                tab === "payments"
                  ? "Search by invoice number or member..."
                  : "Search by member..."
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-lux !py-2.5 text-sm"
            />
          </div>

          {tab === "payments" && (
            <>
              <div className="flex flex-wrap gap-2">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`rounded-lg border px-3.5 py-2 text-sm transition ${
                      period === p.key
                        ? "border-gold/50 bg-gold/15 text-gold-soft"
                        : "border-line text-muted hover:text-charcoal"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="input-lux !w-auto !py-2.5 !pl-4 text-sm"
              >
                <option value="all">All methods</option>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

   <select
     value={staffFilter}
     onChange={(e) => setStaffFilter(e.target.value)}
     className="input-lux !w-auto !py-2.5 !pl-4 text-sm"
   >
     <option value="all">All staff</option>
     {collectors.map((c) => (
       <option key={c.id} value={c.id}>
         {c.name}
       </option>
     ))}
     <option value="none">Not recorded</option>
   </select>

              <button
                onClick={exportCsv}
                disabled={filtered.length === 0}
                className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-charcoal disabled:opacity-50"
              >
                <Download size={15} /> Export CSV
              </button>
            </>
          )}
        </div>

        {tab === "payments" ? (
          filtered.length === 0 ? (
            <div className="grid place-items-center p-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <CreditCard size={24} />
              </div>
              <p className="mt-4 font-display text-xl">
                {payments.length === 0 ? "No payments yet" : "No payments found"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {payments.length === 0
                  ? "Payments appear here when you assign a membership or collect a due."
                  : "Try a different period, method or search."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                      <th className="px-6 py-4 font-medium">Invoice</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Member</th>
                      <th className="px-6 py-4 font-medium">Plan</th>
                      <th className="px-6 py-4 font-medium">Method</th>
                      <th className="px-6 py-4 font-medium">Collected by</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const st = payState(p);
                      const refundable = p.amount - (p.refundedAmount ?? 0);
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-line/60 transition last:border-0 hover:bg-gold/5"
                        >
                          <td className="px-6 py-4 font-medium">
                            {p.invoiceNo}
                            {p.type === "due" && (
                              <span className="ml-2 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold-soft">
                                Balance
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-muted">{fmtDate(p.date)}</td>
                          <td className="px-6 py-4">
                            <Link
                              to={`/app/members/${p.memberId}`}
                              className="hover:underline"
                            >
                              {p.memberName}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-muted">{p.planName}</td>
                          <td className="px-6 py-4 text-muted">{p.method}</td>
                             <td className="px-6 py-4">
     <CollectedBy name={p.collectedByName} role={p.collectedByRole} />
   </td>
                          <td className="px-6 py-4 font-medium">
                            {rupee(p.amount)}
                            {(p.refundedAmount ?? 0) > 0 && (
                              <p className="text-xs font-normal text-red-600">
                                - {rupee(p.refundedAmount ?? 0)} refunded
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-xs ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-end gap-1">
                              <button
                                title="View receipt"
                                onClick={() => setReceipt(p)}
                                className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                              >
                                <FileText size={16} />
                              </button>
                              <button
                                title="Refund"
                               disabled={refundable <= 0 || !can("billing.refund")}
                                
                                onClick={() => setRefund(p)}
                                className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <Undo2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end border-t border-line px-6 py-4 text-sm">
                <span className="text-muted">
                  Total collected (after refunds):{" "}
                  <b className="text-charcoal">{rupee(filteredTotal)}</b>
                </span>
              </div>
            </>
          )
        ) : dueRows.length === 0 ? (
          <div className="grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
              <Wallet size={24} />
            </div>
            <p className="mt-4 font-display text-xl">No pending dues</p>
            <p className="mt-1 text-sm text-muted">
              Every membership is fully paid. Nice work!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-4 font-medium">Member</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium">Ends</th>
                  <th className="px-6 py-4 font-medium">Total</th>
                  <th className="px-6 py-4 font-medium">Paid</th>
                  <th className="px-6 py-4 font-medium">Due</th>
                  <th className="px-6 py-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {dueRows.map((m) => {
                  const overdue = m.endDate < today;
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-line/60 transition last:border-0 hover:bg-gold/5"
                    >
                      <td className="px-6 py-4">
                        <Link to={`/app/members/${m.memberId}`} className="hover:underline">
                          {m.memberName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-muted">{m.planName}</td>
                      <td className="px-6 py-4">
                        <p>{fmtDate(m.endDate)}</p>
                        {overdue && <p className="text-xs text-red-600">Overdue</p>}
                      </td>
                      <td className="px-6 py-4">{rupee(m.total)}</td>
                      <td className="px-6 py-4 text-emerald-700">{rupee(m.paid)}</td>
                      <td className="px-6 py-4 font-medium text-red-600">
                        {rupee(m.total - m.paid)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setCollect(m)}
                          className="rounded-lg bg-gold/15 px-3.5 py-1.5 text-xs font-medium text-gold-soft transition hover:bg-gold/25"
                        >
                          Collect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {collect && businessId && (
        <CollectPaymentModal
          key={collect.id}
          businessId={businessId}
          membership={collect}
          onClose={() => setCollect(null)}
        />
      )}

      {refund && businessId && (
        <RefundModal
          key={refund.id}
          businessId={businessId}
          payment={refund}
          onClose={() => setRefund(null)}
        />
      )}

      {receipt && (
        <ReceiptModal
          payment={receipt}
          settings={settings}
          businessName={business?.name ?? ""}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}