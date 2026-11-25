import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
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
  ArrowLeft,
  Boxes,
  Hourglass,
  IndianRupee,
  Minus,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import type { Member } from "../../types";
import { useOwner } from "../OwnerContext";
import type {
  Product,
  ProductInput,
  StockMode,
  StockMovement,
  Supplier,
} from "../inventoryTypes";
import { MOVE_STYLE, whenOf } from "../inventoryUi";
import { addDays, fmtDate, rupee, todayStr } from "../utils";
import ProductModal from "../components/ProductModal";
import StockModal from "../components/StockModal";
import SellModal from "../components/SellModal";

type MoveFilter = "all" | StockMode;

const FILTERS: { key: MoveFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in", label: "Stock in" },
  { key: "out", label: "Stock out" },
  { key: "sale", label: "Sales" },
  { key: "adjust", label: "Corrections" },
];

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid rgba(201,162,39,0.4)",
  borderRadius: 12,
  color: "#17151f",
};

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { businessId } = useOwner();
  const { profile } = useAuth();
  const actor = profile?.name || "Staff";
  const today = todayStr();

  const [product, setProduct] = useState<Product | null>(null);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<MoveFilter>("all");

  const [editOpen, setEditOpen] = useState(false);
  const [stockMode, setStockMode] = useState<"in" | "out" | "adjust" | null>(null);
  const [sellOpen, setSellOpen] = useState(false);

  useEffect(() => {
    if (!businessId || !id) return;

    const u1 = onSnapshot(
      doc(db, "businesses", businessId, "inventoryItems", id),
      (snap) => {
        setProduct(snap.exists() ? ({ id: snap.id, ...snap.data() } as Product) : null);
        setLoaded(true);
      },
      () => setLoaded(true)
    );

    // Only one filter, so no composite index is needed. Sorted in the browser.
    const u2 = onSnapshot(
      query(collection(db, "businesses", businessId, "stockMovements"), where("itemId", "==", id)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StockMovement);
        list.sort(
          (a, b) =>
            (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
        );
        setMoves(list);
      },
      () => {
        /* history is optional */
      }
    );

    const u3 = onSnapshot(collection(db, "businesses", businessId, "suppliers"), (snap) =>
      setSuppliers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Supplier))
    );
    const u4 = onSnapshot(collection(db, "businesses", businessId, "members"), (snap) =>
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member))
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [businessId, id]);

  const stats = useMemo(() => {
    if (!product) return null;

    const sales = moves.filter((m) => m.type === "sale");
    const unitsSold = sales.reduce((s, m) => s + Math.abs(m.change), 0);
    const revenue = sales.reduce((s, m) => s + m.total, 0);
    const profit = revenue - unitsSold * product.costPrice;

    const from30 = addDays(today, -29);
    const recent = sales.filter((m) => m.date >= from30 && m.date <= today);
    const units30 = recent.reduce((s, m) => s + Math.abs(m.change), 0);
    const perDay = units30 / 30;

    const days = Array.from({ length: 30 }, (_, i) => addDays(from30, i));
    const chart = days.map((d) => ({
      label: `${d.slice(8)}/${d.slice(5, 7)}`,
      v: recent.filter((m) => m.date === d).reduce((s, m) => s + Math.abs(m.change), 0),
    }));

    const buyers: Record<string, { n: number; spent: number }> = {};
    sales.forEach((m) => {
      const k = m.buyer?.trim() || "Walk-in customer";
      buyers[k] ??= { n: 0, spent: 0 };
      buyers[k].n += Math.abs(m.change);
      buyers[k].spent += m.total;
    });

    const lastIn = moves.find((m) => m.type === "in" && m.note !== "Opening stock");

    return {
      unitsSold,
      revenue,
      profit,
      units30,
      daysLeft: perDay > 0 ? Math.floor(product.stock / perDay) : null,
      chart,
      buyers: Object.entries(buyers)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 5),
      stockedTotal: moves.filter((m) => m.type === "in").reduce((s, m) => s + m.change, 0),
      lastIn,
      margin:
        product.sellPrice > 0
          ? Math.round(((product.sellPrice - product.costPrice) / product.sellPrice) * 100)
          : 0,
    };
  }, [moves, product, today]);

  const rows = useMemo(
    () => moves.filter((m) => filter === "all" || m.type === filter),
    [moves, filter]
  );

  if (!loaded) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  if (!product || !stats || !businessId) {
    return (
      <div className="card grid place-items-center p-16 text-center">
        <p className="font-display text-xl">Product not found</p>
        <Link to="/app/inventory" className="btn-gold mt-5 px-5 py-2 text-sm">
          Back to inventory
        </Link>
      </div>
    );
  }

  const state = product.stock <= 0 ? "out" : product.stock <= product.lowStockAt ? "low" : "ok";

  const saveProduct = async (data: ProductInput) => {
    const sup = suppliers.find((s) => s.id === data.supplierId);
    await updateDoc(doc(db, "businesses", businessId, "inventoryItems", product.id), {
      ...data,
      supplierName: sup?.name ?? "",
      updatedAt: serverTimestamp(),
    });
  };

  const remove = async () => {
    if (
      !window.confirm(
        `Delete "${product.name}"? Past stock history stays in the database. If you only want to hide it, set it to Inactive instead.`
      )
    )
      return;
    await deleteDoc(doc(db, "businesses", businessId, "inventoryItems", product.id));
    navigate("/app/inventory");
  };

  const cards = [
    {
      label: "In Stock",
      value: `${product.stock} ${product.unit}`,
      sub: `Stock value ${rupee(Math.max(0, product.stock) * product.costPrice)}`,
      icon: Boxes,
    },
    {
      label: "Units Sold",
      value: String(stats.unitsSold),
      sub: `${stats.units30} in the last 30 days`,
      icon: ShoppingCart,
    },
    {
      label: "Revenue",
      value: rupee(stats.revenue),
      sub: "All time sales",
      icon: IndianRupee,
    },
    {
      label: "Profit",
      value: rupee(stats.profit),
      sub: "Revenue minus cost price",
      icon: TrendingUp,
    },
  ];

  const btn =
    "flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm transition hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-8">
      <Link
        to="/app/inventory"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-charcoal"
      >
        <ArrowLeft size={16} /> Back to inventory
      </Link>

      {/* Header */}
      <div className="card flex flex-wrap items-center justify-between gap-5 p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-charcoal text-gold-light">
            <Package size={26} />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">{product.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {product.category}
              {product.sku ? ` · ${product.sku}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {state === "out" && (
                <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-700">
                  Out of stock
                </span>
              )}
              {state === "low" && (
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-700">
                  Low stock
                </span>
              )}
              {state === "ok" && (
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700">
                  In stock
                </span>
              )}
              {product.status === "inactive" && (
                <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs text-slate-600">
                  Inactive
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSellOpen(true)}
            disabled={product.stock <= 0 || product.status === "inactive"}
            className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm disabled:cursor-not-allowed"
          >
            <ShoppingCart size={16} /> Sell
          </button>
          <button onClick={() => setStockMode("in")} className={btn}>
            <Plus size={16} /> Add stock
          </button>
          <button onClick={() => setStockMode("out")} disabled={product.stock <= 0} className={btn}>
            <Minus size={16} /> Remove
          </button>
          <button onClick={() => setStockMode("adjust")} className={btn}>
            <SlidersHorizontal size={16} /> Correct count
          </button>
          <button onClick={() => setEditOpen(true)} className={btn}>
            <Pencil size={16} /> Edit
          </button>
          <button onClick={remove} className={`${btn} hover:!border-red-400 hover:text-red-600`}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {state !== "ok" && (
        <div className="card flex items-center gap-3 !border-gold/50 p-5 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-gold-soft" />
          {state === "out"
            ? "This product is out of stock, so it cannot be sold until you add stock."
            : `Only ${product.stock} ${product.unit} left. The low-stock alert level is ${product.lowStockAt}.`}
        </div>
      )}

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
              <p className={`mt-6 font-display text-3xl font-semibold ${dark ? "text-gold-light" : ""}`}>
                {value}
              </p>
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-charcoal"}`}>{label}</p>
              <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>{sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <div className="card p-6">
            <h3 className="font-display text-xl">Units Sold, Last 30 Days</h3>
            <p className="text-sm text-muted">
              {stats.daysLeft === null
                ? "No sales in the last 30 days, so a stock forecast is not possible yet."
                : `At this pace the stock lasts about ${stats.daysLeft} more day${stats.daysLeft === 1 ? "" : "s"}.`}
            </p>
            <div className="mt-5 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chart}>
                  <CartesianGrid stroke="rgba(40,30,10,0.07)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#7a7466"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    interval="preserveStartEnd"
                  />
                  <YAxis stroke="#7a7466" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, "Units sold"]} contentStyle={tooltipStyle} />
                  <Bar dataKey="v" fill="#c9a227" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
              <div>
                <h3 className="font-display text-xl">Stock History</h3>
                <p className="text-sm text-muted">Every movement of this product</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                      filter === f.key
                        ? "border-gold/50 bg-gold/15 text-gold-soft"
                        : "border-line text-muted hover:text-charcoal"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">No movements found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                      <th className="px-6 py-3 font-medium">When</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">Change</th>
                      <th className="px-6 py-3 font-medium">Balance</th>
                      <th className="px-6 py-3 font-medium">Details</th>
                      <th className="px-6 py-3 font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => (
                      <tr key={m.id} className="border-b border-line/60 last:border-0">
                        <td className="whitespace-nowrap px-6 py-3 text-muted">{whenOf(m.createdAt)}</td>
                        <td className="px-6 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs ${MOVE_STYLE[m.type].cls}`}>
                            {MOVE_STYLE[m.type].label}
                          </span>
                        </td>
                        <td
                          className={`px-6 py-3 font-medium ${
                            m.change > 0 ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {m.change > 0 ? `+${m.change}` : m.change}
                        </td>
                        <td className="px-6 py-3">{m.balance}</td>
                        <td className="px-6 py-3 text-muted">
                          {m.type === "sale"
                            ? `${rupee(m.total)} · ${m.method}${m.buyer ? ` · ${m.buyer}` : ""}`
                            : m.note || "—"}
                        </td>
                        <td className="px-6 py-3 text-muted">{m.by}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="font-display text-xl">Pricing & Details</h3>
            <dl className="mt-5 space-y-4 text-sm">
              {[
                ["Selling price", rupee(product.sellPrice)],
                ["Cost price", rupee(product.costPrice)],
                [
                  "Profit per unit",
                  `${rupee(product.sellPrice - product.costPrice)} (${stats.margin}% margin)`,
                ],
                ["Stock at selling price", rupee(Math.max(0, product.stock) * product.sellPrice)],
                ["Low-stock alert at", `${product.lowStockAt} ${product.unit}`],
                ["Supplier", product.supplierName || "—"],
                ["Total ever stocked", `${stats.stockedTotal} ${product.unit}`],
                [
                  "Last restocked",
                  stats.lastIn ? whenOf(stats.lastIn.createdAt) : "—",
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-xl">Top Buyers</h3>
            <p className="text-sm text-muted">By amount spent</p>
            {stats.buyers.length === 0 ? (
              <div className="mt-5 flex items-center gap-3 text-sm text-muted">
                <Hourglass size={16} /> No sales yet.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {stats.buyers.map((b, i) => (
                  <div
                    key={b.name}
                    className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3"
                  >
                    <span className="w-5 text-sm text-muted">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted">{b.n} unit(s)</p>
                    </div>
                    <span className="text-sm font-medium">{rupee(b.spent)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="px-2 text-xs text-muted">
            Profit uses the current cost price. Today is {fmtDate(today)}.
          </p>
        </div>
      </div>

      {editOpen && (
        <ProductModal
          key={product.id}
          product={product}
          suppliers={suppliers}
          onClose={() => setEditOpen(false)}
          onSave={saveProduct}
        />
      )}

      {stockMode && (
        <StockModal
          key={stockMode}
          businessId={businessId}
          product={product}
          mode={stockMode}
          by={actor}
          onClose={() => setStockMode(null)}
        />
      )}

      {sellOpen && (
        <SellModal
          key={product.id}
          businessId={businessId}
          product={product}
          members={members}
          by={actor}
          onClose={() => setSellOpen(false)}
        />
      )}
    </div>
  );
}