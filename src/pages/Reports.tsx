import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Clock, IndianRupee, TrendingUp } from "lucide-react";
import { useCollection } from "../useCollection";
import type { Business, Payment } from "../types";

const GOLD = "#c9a227";
const COLORS = ["#c9a227", "#17151f", "#97731a", "#ecd486", "#7a7466", "#b8902c"];

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const lastMonths = (n: number) => {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      key: monthKey(d),
      label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    };
  });
};

export default function Reports() {
  const pay = useCollection<Payment>("payments");
  const biz = useCollection<Business>("businesses");
  const [range, setRange] = useState<6 | 12>(6);

  const loading = pay.loading || biz.loading;
  const error = pay.error || biz.error;

  const data = useMemo(() => {
    const payments = pay.data;
    const businesses = biz.data;
    const months = lastMonths(range);

    const revenueByMonth = months.map((m) => ({
      month: m.label,
      revenue: payments
        .filter((p) => p.status === "paid" && (p.date ?? "").slice(0, 7) === m.key)
        .reduce((s, p) => s + (p.amount || 0), 0),
    }));

    const signupsByMonth = months.map((m) => ({
      month: m.label,
      businesses: businesses.filter(
        (b) => b.createdAt && monthKey(b.createdAt.toDate()) === m.key
      ).length,
    }));

    const planCount: Record<string, number> = {};
    businesses.forEach((b) => {
      const k = b.plan || "No plan";
      planCount[k] = (planCount[k] ?? 0) + 1;
    });
    const planDist = Object.entries(planCount).map(([name, value]) => ({ name, value }));

    const statuses = ["paid", "pending", "failed", "refunded"] as const;
    const statusDist = statuses
      .map((s) => ({
        name: s,
        value: payments.filter((p) => p.status === s).length,
      }))
      .filter((x) => x.value > 0);

    const thisKey = monthKey(new Date());
    const paid = payments.filter((p) => p.status === "paid");
    const totalRevenue = paid.reduce((s, p) => s + (p.amount || 0), 0);
    const thisMonth = paid
      .filter((p) => (p.date ?? "").slice(0, 7) === thisKey)
      .reduce((s, p) => s + (p.amount || 0), 0);
    const pendingAmt = payments
      .filter((p) => p.status === "pending")
      .reduce((s, p) => s + (p.amount || 0), 0);
    const activeBiz = businesses.filter((b) => b.status === "active").length;

    const byBiz: Record<string, number> = {};
    paid.forEach((p) => {
      const k = p.businessName || "Unknown";
      byBiz[k] = (byBiz[k] ?? 0) + (p.amount || 0);
    });
    const top = Object.entries(byBiz)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      revenueByMonth,
      signupsByMonth,
      planDist,
      statusDist,
      totalRevenue,
      thisMonth,
      pendingAmt,
      activeBiz,
      top,
    };
  }, [pay.data, biz.data, range]);

  const kpis = [
    { label: "Total Revenue", value: inr(data.totalRevenue), icon: IndianRupee },
    { label: "This Month", value: inr(data.thisMonth), icon: TrendingUp },
    { label: "Pending Amount", value: inr(data.pendingAmt), icon: Clock },
    { label: "Active Businesses", value: String(data.activeBiz), icon: Building2 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Insights</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Reports & <span className="gold-text">Analytics</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Live figures for revenue, signups and payments, straight from Firebase.
          </p>
        </div>
        <div className="flex gap-2">
          {([6, 12] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-lg border px-4 py-2 text-sm transition ${
                range === r
                  ? "border-gold/50 bg-gold/15 text-gold-soft"
                  : "border-line text-muted hover:text-charcoal"
              }`}
            >
              Last {r} months
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center p-20">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
        </div>
      ) : error ? (
        <p className="p-10 text-center text-sm text-red-700">
          Could not load data. Please check your Firestore rules.
        </p>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card p-6">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold-soft">
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <p className="mt-6 font-display text-3xl font-semibold">{value}</p>
                <p className="mt-1 text-sm text-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="card p-6 xl:col-span-2">
              <h3 className="font-display text-xl">Monthly revenue</h3>
              <p className="text-xs text-muted">Paid payments only</p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(40,30,10,0.08)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#7a7466" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#7a7466" }} />
                    <Tooltip formatter={(v) => inr(Number(v))} />
                    <Bar dataKey="revenue" fill={GOLD} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-display text-xl">Businesses by plan</h3>
              {data.planDist.length === 0 ? (
                <p className="mt-10 text-center text-sm text-muted">No businesses yet.</p>
              ) : (
                <>
                  <div className="mt-4 h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.planDist}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                        >
                          {data.planDist.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {data.planDist.map((p, i) => (
                      <li key={p.name} className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          {p.name}
                        </span>
                        <span className="text-muted">{p.value}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="card p-6 xl:col-span-2">
              <h3 className="font-display text-xl">New businesses</h3>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.signupsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(40,30,10,0.08)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#7a7466" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#7a7466" }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="businesses"
                      stroke="#17151f"
                      strokeWidth={2}
                      dot={{ r: 4, fill: GOLD }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-display text-xl">Payment status</h3>
              {data.statusDist.length === 0 ? (
                <p className="mt-10 text-center text-sm text-muted">No payments yet.</p>
              ) : (
                <ul className="mt-5 space-y-3">
                  {data.statusDist.map((s) => {
                    const total = data.statusDist.reduce((a, b) => a + b.value, 0);
                    const pct = Math.round((s.value / total) * 100);
                    return (
                      <li key={s.name}>
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{s.name}</span>
                          <span className="text-muted">
                            {s.value} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-black/5">
                          <div
                            className="h-2 rounded-full bg-gold"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-line p-5">
              <h3 className="font-display text-xl">Top businesses by revenue</h3>
            </div>
            {data.top.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted">No paid payments yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <tbody>
                  {data.top.map((t, i) => (
                    <tr key={t.name} className="border-b border-line/60 last:border-0">
                      <td className="w-16 px-6 py-4 text-muted">#{i + 1}</td>
                      <td className="px-6 py-4 font-medium">{t.name}</td>
                      <td className="px-6 py-4 text-right font-medium">{inr(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
