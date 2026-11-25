import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { Building2, GitBranch, IndianRupee, CalendarClock, Crown, Plus } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { db } from "../firebase";
import type { Business, Plan } from "../types";

// 1,25,000 -> ₹1.25 L , 1,20,00,000 -> ₹1.20 Cr
function money(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function Dashboard() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadedB, setLoadedB] = useState(false);
  const [loadedP, setLoadedP] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubB = onSnapshot(
      collection(db, "businesses"),
      (snap) => {
        setBusinesses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Business));
        setLoadedB(true);
      },
      () => {
        setError("Could not load data. Please check your Firestore rules.");
        setLoadedB(true);
      }
    );
    const unsubP = onSnapshot(
      collection(db, "plans"),
      (snap) => {
        setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Plan));
        setLoadedP(true);
      },
      () => setLoadedP(true)
    );
    return () => {
      unsubB();
      unsubP();
    };
  }, []);

  // Plan name -> its monthly price
  const planPrice = useMemo(() => {
    const m: Record<string, number> = {};
    plans.forEach((p) => (m[p.name] = p.priceMonthly));
    return m;
  }, [plans]);

  const stats = useMemo(() => {
    const now = new Date();
    const active = businesses.filter((b) => b.status === "active");
    const mrr = active.reduce((sum, b) => sum + (planPrice[b.plan] ?? 0), 0);
    const branches = businesses.reduce((sum, b) => sum + (b.branches || 0), 0);
    const newThisMonth = businesses.filter((b) => {
      const d = b.createdAt?.toDate() ?? now;
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return {
      total: businesses.length,
      active: active.length,
      suspended: businesses.filter((b) => b.status === "suspended").length,
      mrr,
      branches,
      newThisMonth,
    };
  }, [businesses, planPrice]);

  // Last 6 months: total number of businesses at the end of each month
  const growth = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i;
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
      const count = businesses.filter((b) => (b.createdAt?.toDate() ?? now) < end).length;
      return { m: start.toLocaleString("en-IN", { month: "short" }), v: count };
    });
  }, [businesses]);

  // Gyms and revenue per plan
  const planBreakdown = useMemo(() => {
    const rows = [...plans]
      .sort((a, b) => a.priceMonthly - b.priceMonthly)
      .map((p) => {
        const gyms = businesses.filter((b) => b.plan === p.name);
        const activeGyms = gyms.filter((b) => b.status === "active");
        return {
          id: p.id,
          name: p.name,
          gyms: gyms.length,
          revenue: activeGyms.length * p.priceMonthly,
        };
      });
    const max = Math.max(1, ...rows.map((r) => r.gyms));
    return { rows, max };
  }, [plans, businesses]);

  const recent = useMemo(
    () =>
      [...businesses]
        .sort(
          (a, b) => (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
        )
        .slice(0, 5),
    [businesses]
  );

  const cards = [
    {
      label: "Monthly Revenue (MRR)",
      value: money(stats.mrr),
      sub: "Estimated from the plans of active gyms",
      icon: IndianRupee,
    },
    {
      label: "Total Businesses",
      value: String(stats.total),
      sub: `${stats.active} active · ${stats.suspended} suspended`,
      icon: Building2,
      badge: `+${stats.newThisMonth} this month`,
    },
    {
      label: "Total Branches",
      value: String(stats.branches),
      sub: "Across all businesses",
      icon: GitBranch,
    },
    {
      label: "Projected Yearly",
      value: money(stats.mrr * 12),
      sub: "MRR × 12",
      icon: CalendarClock,
    },
  ];

  if (!loadedB || !loadedP) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Overview</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          Platform <span className="gold-text">Dashboard</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          A live snapshot of the whole platform. All of this data comes straight from Firestore.
        </p>
      </div>

      {error && (
        <p className="card p-5 text-center text-sm text-red-700">{error}</p>
      )}

      {stats.total === 0 && !error && (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="font-display text-xl">No businesses yet</p>
            <p className="mt-1 text-sm text-muted">
              Add your first gym and this dashboard will start filling up automatically.
            </p>
          </div>
          <Link to="/businesses" className="btn-gold flex items-center gap-2 px-5 py-3 text-sm">
            <Plus size={18} /> Add Business
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon, badge }, i) => {
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
              <div className="flex items-center justify-between">
                <div
                  className={`grid h-11 w-11 place-items-center rounded-xl border ${
                    dark
                      ? "border-gold/30 bg-gold/15 text-gold-light"
                      : "border-gold/25 bg-gold/10 text-gold-soft"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                {badge && (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700">
                    {badge}
                  </span>
                )}
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
        {/* Growth chart */}
        <div className="card p-6 xl:col-span-2">
          <h3 className="font-display text-xl">Business Growth</h3>
          <p className="text-sm text-muted">Total businesses over the last 6 months</p>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c9a227" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#c9a227" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(40,30,10,0.07)" vertical={false} />
                <XAxis dataKey="m" stroke="#7a7466" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#7a7466"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid rgba(201,162,39,0.4)",
                    borderRadius: 12,
                    color: "#17151f",
                  }}
                />
                <Area
                  name="Businesses"
                  type="monotone"
                  dataKey="v"
                  stroke="#b8902c"
                  strokeWidth={2.5}
                  fill="url(#gold)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan-wise breakdown */}
        <div className="card p-6">
          <h3 className="font-display text-xl">Plan-wise Breakdown</h3>
          <p className="text-sm text-muted">How each plan is performing</p>

          {planBreakdown.rows.length === 0 ? (
            <div className="mt-8 grid place-items-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <Crown size={20} />
              </div>
              <p className="mt-3 text-sm text-muted">No plans yet.</p>
              <Link to="/plans" className="mt-2 text-sm text-gold-soft underline">
                Create plans
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {planBreakdown.rows.map((r) => (
                <div key={r.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-muted">
                      {r.gyms} gym{r.gyms === 1 ? "" : "s"} · {money(r.revenue)}/mo
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gold/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold transition-all"
                      style={{ width: `${(r.gyms / planBreakdown.max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent businesses */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-xl">Recent Businesses</h3>
            <p className="text-sm text-muted">Newly joined gyms</p>
          </div>
          <Link to="/businesses" className="text-sm text-gold-soft underline">
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="mt-6 text-sm text-muted">No businesses yet.</p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recent.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3 transition hover:border-gold/40"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-charcoal text-gold-light">
                  {b.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-muted">
                    {b.branches} branch{b.branches === 1 ? "" : "es"}
                    {b.city ? ` · ${b.city}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs text-gold-soft">
                    {b.plan}
                  </span>
                  <span
                    className={`text-[11px] capitalize ${
                      b.status === "active" ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
