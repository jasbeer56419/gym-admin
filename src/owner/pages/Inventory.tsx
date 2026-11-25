import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  AlertTriangle,
  Boxes,
  Dumbbell,
  Eye,
  IndianRupee,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import type { Member } from "../../types";
import { useOwner } from "../OwnerContext";
import type {
  Equipment,
  EquipmentInput,
  EquipmentLog,
  Product,
  ProductInput,
  StockMovement,
  Supplier,
  SupplierInput,
} from "../inventoryTypes";
import { EQUIP_STATUS, MOVE_STYLE } from "../inventoryUi";
import { addDays, daysBetween, fmtDate, rupee, todayStr } from "../utils";
import ProductModal from "../components/ProductModal";
import StockModal from "../components/StockModal";
import SellModal from "../components/SellModal";
import SupplierModal from "../components/SupplierModal";
import EquipmentModal from "../components/EquipmentModal";
import MaintenanceModal from "../components/MaintenanceModal";

type Tab = "products" | "equipment" | "suppliers" | "history";
type StockFilter = "all" | "low" | "out";
type EquipFilter = "active" | "attention" | "retired";

const when = (m: { createdAt?: { toDate: () => Date } | null }) =>
  m.createdAt
    ? m.createdAt.toDate().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "just now";

export default function Inventory() {
  const { businessId, branches, branchId } = useOwner();
  const { profile } = useAuth();
  const actor = profile?.name || "Staff";

  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [monthMoves, setMonthMoves] = useState<StockMovement[]>([]);
  const [logs, setLogs] = useState<EquipmentLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState({ products: false, equipment: false, suppliers: false });
  const [error, setError] = useState("");

  const today = todayStr();
  const [tab, setTab] = useState<Tab>("products");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [equipFilter, setEquipFilter] = useState<EquipFilter>("active");

  const [prodModal, setProdModal] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  const [stockFor, setStockFor] = useState<{ product: Product; mode: "in" | "out" | "adjust" } | null>(
    null
  );
  const [sellFor, setSellFor] = useState<Product | null>(null);
  const [supModal, setSupModal] = useState<{ open: boolean; supplier: Supplier | null }>({
    open: false,
    supplier: null,
  });
  const [eqModal, setEqModal] = useState<{ open: boolean; item: Equipment | null }>({
    open: false,
    item: null,
  });
  const [maintFor, setMaintFor] = useState<Equipment | null>(null);

  const activeBranches = branches.filter((b) => b.status === "active");

  useEffect(() => {
    if (!businessId) return;
    const monthStart = `${todayStr().slice(0, 7)}-01`;

    const fail = () => {
      setError("Could not load inventory data. Please try again.");
      setLoaded({ products: true, equipment: true, suppliers: true });
    };

    const u1 = onSnapshot(
      collection(db, "businesses", businessId, "inventoryItems"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
        list.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(list);
        setLoaded((l) => ({ ...l, products: true }));
      },
      fail
    );
    const u2 = onSnapshot(
      collection(db, "businesses", businessId, "suppliers"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Supplier);
        list.sort((a, b) => a.name.localeCompare(b.name));
        setSuppliers(list);
        setLoaded((l) => ({ ...l, suppliers: true }));
      },
      fail
    );
    const u3 = onSnapshot(
      collection(db, "businesses", businessId, "equipment"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Equipment);
        list.sort((a, b) => a.name.localeCompare(b.name));
        setEquipment(list);
        setLoaded((l) => ({ ...l, equipment: true }));
      },
      fail
    );
    const u4 = onSnapshot(
      query(
        collection(db, "businesses", businessId, "stockMovements"),
        orderBy("createdAt", "desc"),
        limit(200)
      ),
      (snap) => setMoves(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StockMovement)),
      () => {
        /* history is optional */
      }
    );
    // Everything this month, so the sales total is always complete
    const u5 = onSnapshot(
      query(collection(db, "businesses", businessId, "stockMovements"), where("date", ">=", monthStart)),
      (snap) => setMonthMoves(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StockMovement)),
      () => {
        /* optional */
      }
    );
    const u6 = onSnapshot(
      query(
        collection(db, "businesses", businessId, "equipmentLogs"),
        orderBy("createdAt", "desc"),
        limit(300)
      ),
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EquipmentLog)),
      () => {
        /* optional */
      }
    );
    const u7 = onSnapshot(collection(db, "businesses", businessId, "members"), (snap) =>
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member))
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, [businessId]);

  // ---------- helpers ----------

  const stockState = (p: Product): "out" | "low" | "ok" =>
    p.stock <= 0 ? "out" : p.stock <= p.lowStockAt ? "low" : "ok";

  const needsAttention = (e: Equipment) =>
    e.status !== "retired" &&
    (e.status !== "working" || (!!e.nextServiceDate && e.nextServiceDate < today));

  const serviceInfo = (e: Equipment): { text: string; cls: string } => {
    if (e.serviceEveryDays <= 0) return { text: "No regular service", cls: "text-muted" };
    if (!e.nextServiceDate) return { text: "Next service not set", cls: "text-muted" };
    const d = daysBetween(today, e.nextServiceDate);
    if (d < 0) return { text: `Service overdue by ${-d} day${d === -1 ? "" : "s"}`, cls: "font-medium text-red-600" };
    if (d === 0) return { text: "Service due today", cls: "font-medium text-amber-700" };
    if (d <= 7) return { text: `Service due in ${d} day${d === 1 ? "" : "s"}`, cls: "font-medium text-amber-700" };
    return { text: `Next service ${fmtDate(e.nextServiceDate)}`, cls: "text-muted" };
  };

  // ---------- derived data ----------

  const lowCount = products.filter((p) => p.status === "active" && stockState(p) !== "ok").length;

  const stockValue = products.reduce((s, p) => s + Math.max(0, p.stock) * p.costPrice, 0);

  const sales = monthMoves.filter((m) => m.type === "sale");
  const salesTotal = sales.reduce((s, m) => s + m.total, 0);

  const scopedEquipment = useMemo(
    () => equipment.filter((e) => branchId === "all" || e.branchId === branchId),
    [equipment, branchId]
  );
  const attentionCount = scopedEquipment.filter(needsAttention).length;

  const productRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const st = stockState(p);
      const okStock =
        stockFilter === "all" ? true : stockFilter === "low" ? st === "low" : st === "out";
      const okSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q);
      return okStock && okSearch;
    });
  }, [products, search, stockFilter]);

  const equipRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedEquipment.filter((e) => {
      const okFilter =
        equipFilter === "retired"
          ? e.status === "retired"
          : equipFilter === "attention"
            ? needsAttention(e)
            : e.status !== "retired";
      const okSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.brand.toLowerCase().includes(q) ||
        e.serialNo.toLowerCase().includes(q);
      return okFilter && okSearch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedEquipment, search, equipFilter, today]);

  // ---------- actions ----------

  const saveProduct = async (data: ProductInput, openingStock: number) => {
    if (!businessId) return;
    const sup = suppliers.find((s) => s.id === data.supplierId);
    const payload = { ...data, supplierName: sup?.name ?? "" };

    if (prodModal.product) {
      await updateDoc(doc(db, "businesses", businessId, "inventoryItems", prodModal.product.id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const ref = doc(collection(db, "businesses", businessId, "inventoryItems"));
    const batch = writeBatch(db);
    batch.set(ref, { ...payload, stock: openingStock, createdAt: serverTimestamp() });
    if (openingStock > 0) {
      batch.set(doc(collection(db, "businesses", businessId, "stockMovements")), {
        itemId: ref.id,
        itemName: data.name,
        type: "in",
        change: openingStock,
        balance: openingStock,
        unitPrice: 0,
        total: 0,
        method: "",
        buyer: "",
        note: "Opening stock",
        by: actor,
        date: todayStr(),
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  };

  const removeProduct = async (p: Product) => {
    if (!businessId) return;
    if (
      window.confirm(
        `Delete "${p.name}"? Past stock history stays. If you only want to hide it, set it to Inactive instead.`
      )
    ) {
      await deleteDoc(doc(db, "businesses", businessId, "inventoryItems", p.id));
    }
  };

  const saveSupplier = async (data: SupplierInput) => {
    if (!businessId) return;
    if (supModal.supplier) {
      const id = supModal.supplier.id;
      const batch = writeBatch(db);
      batch.update(doc(db, "businesses", businessId, "suppliers", id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      // Keep the supplier name on the products in step
      products
        .filter((p) => p.supplierId === id)
        .forEach((p) =>
          batch.update(doc(db, "businesses", businessId, "inventoryItems", p.id), {
            supplierName: data.name,
          })
        );
      await batch.commit();
    } else {
      await addDoc(collection(db, "businesses", businessId, "suppliers"), {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
  };

  const removeSupplier = async (s: Supplier) => {
    if (!businessId) return;
    const used = products.filter((p) => p.supplierId === s.id).length;
    if (used > 0) {
      window.alert(`"${s.name}" is linked to ${used} product(s). Change the supplier on those products first.`);
      return;
    }
    if (window.confirm(`Delete the supplier "${s.name}"? This cannot be undone.`)) {
      await deleteDoc(doc(db, "businesses", businessId, "suppliers", s.id));
    }
  };

  const saveEquipment = async (data: EquipmentInput) => {
    if (!businessId) return;
    const branch = branches.find((b) => b.id === data.branchId);
    const base = data.lastServiceDate || data.purchaseDate || todayStr();
    const payload = {
      ...data,
      branchName: branch?.name ?? eqModal.item?.branchName ?? "",
      nextServiceDate: data.serviceEveryDays > 0 ? addDays(base, data.serviceEveryDays) : "",
    };

    if (eqModal.item) {
      await updateDoc(doc(db, "businesses", businessId, "equipment", eqModal.item.id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, "businesses", businessId, "equipment"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  };

  const removeEquipment = async (e: Equipment) => {
    if (!businessId) return;
    if (
      window.confirm(
        `Delete "${e.name}"? This cannot be undone. If the machine is just gone, set it to Retired instead.`
      )
    ) {
      await deleteDoc(doc(db, "businesses", businessId, "equipment", e.id));
    }
  };

  // ---------- render ----------

  const cards = [
    { label: "Stock Value", value: rupee(stockValue), sub: "At cost price", icon: Boxes },
    {
      label: "Low Stock",
      value: String(lowCount),
      sub: "Low or out of stock",
      icon: AlertTriangle,
    },
    {
      label: "Sales This Month",
      value: rupee(salesTotal),
      sub: `${sales.length} sale${sales.length === 1 ? "" : "s"}`,
      icon: IndianRupee,
    },
    {
      label: "Equipment Alerts",
      value: String(attentionCount),
      sub: "Need attention",
      icon: Wrench,
    },
  ];

  if (!loaded.products || !loaded.equipment || !loaded.suppliers) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "products", label: `Products (${products.length})` },
    { key: "equipment", label: `Equipment (${scopedEquipment.length})` },
    { key: "suppliers", label: `Suppliers (${suppliers.length})` },
    { key: "history", label: "Stock History" },
  ];

  const chip = (on: boolean) =>
    `rounded-lg border px-3.5 py-2 text-sm transition ${
      on ? "border-gold/50 bg-gold/15 text-gold-soft" : "border-line text-muted hover:text-charcoal"
    }`;

  const iconBtn =
    "rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Business</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Inventory & <span className="gold-text">Equipment</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Track product stock and sales, your equipment register and every maintenance job.
          </p>
        </div>

        {tab === "products" && (
          <button
            onClick={() => setProdModal({ open: true, product: null })}
            className="btn-gold flex items-center gap-2 px-5 py-3 text-sm"
          >
            <Plus size={18} /> Add Product
          </button>
        )}
        {tab === "equipment" && (
          <button
            onClick={() => setEqModal({ open: true, item: null })}
            disabled={activeBranches.length === 0}
            title={activeBranches.length === 0 ? "Add a branch first" : "Add equipment"}
            className="btn-gold flex items-center gap-2 px-5 py-3 text-sm disabled:cursor-not-allowed"
          >
            <Plus size={18} /> Add Equipment
          </button>
        )}
        {tab === "suppliers" && (
          <button
            onClick={() => setSupModal({ open: true, supplier: null })}
            className="btn-gold flex items-center gap-2 px-5 py-3 text-sm"
          >
            <Plus size={18} /> Add Supplier
          </button>
        )}
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
              <p className={`mt-6 font-display text-3xl font-semibold ${dark ? "text-gold-light" : ""}`}>
                {value}
              </p>
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-charcoal"}`}>{label}</p>
              <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>{sub}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setSearch("");
            }}
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

      {/* ---------------- Products ---------------- */}
      {tab === "products" && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                placeholder="Search by name, category or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-lux !py-2.5 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "all", label: "All" },
                  { key: "low", label: "Low stock" },
                  { key: "out", label: "Out of stock" },
                ] as { key: StockFilter; label: string }[]
              ).map((f) => (
                <button key={f.key} onClick={() => setStockFilter(f.key)} className={chip(stockFilter === f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {productRows.length === 0 ? (
            <div className="grid place-items-center p-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <Package size={24} />
              </div>
              <p className="mt-4 font-display text-xl">
                {products.length === 0 ? "No products yet" : "No products found"}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted">
                {products.length === 0
                  ? 'Click "Add Product" to add your first product, like protein, drinks or merchandise.'
                  : "Try a different search or filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                    <th className="px-6 py-4 font-medium">Product</th>
                    <th className="px-6 py-4 font-medium">Stock</th>
                    <th className="px-6 py-4 font-medium">Price</th>
                    <th className="px-6 py-4 font-medium">Supplier</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((p) => {
                    const st = stockState(p);
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-line/60 transition last:border-0 hover:bg-gold/5 ${
                          p.status === "inactive" ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium">
                            <Link to={`/app/inventory/products/${p.id}`} className="hover:underline">
                              {p.name}
                            </Link>
                            {p.status === "inactive" && (
                              <span className="ml-2 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-600">
                                Inactive
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted">
                            {p.category}
                            {p.sku ? ` · ${p.sku}` : ""}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium">
                            {p.stock} <span className="text-xs font-normal text-muted">{p.unit}</span>
                          </span>
                          {st === "out" && (
                            <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700">
                              Out of stock
                            </span>
                          )}
                          {st === "low" && (
                            <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">
                              Low
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p>{rupee(p.sellPrice)}</p>
                          <p className="text-xs text-muted">Cost {rupee(p.costPrice)}</p>
                        </td>
                        <td className="px-6 py-4 text-muted">{p.supplierName || "—"}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={`/app/inventory/products/${p.id}`}
                              title="View details"
                              className={iconBtn}
                            >
                              <Eye size={16} />
                            </Link>
                            <button
                              onClick={() => setSellFor(p)}
                              disabled={p.stock <= 0 || p.status === "inactive"}
                              className="flex items-center gap-1 rounded-lg bg-gold/15 px-3 py-1.5 text-xs font-medium text-gold-soft transition hover:bg-gold/25 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <ShoppingCart size={13} /> Sell
                            </button>
                            <button
                              title="Add stock"
                              onClick={() => setStockFor({ product: p, mode: "in" })}
                              className={iconBtn}
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              title="Remove stock"
                              onClick={() => setStockFor({ product: p, mode: "out" })}
                              disabled={p.stock <= 0}
                              className={`${iconBtn} disabled:cursor-not-allowed disabled:opacity-30`}
                            >
                              <Minus size={16} />
                            </button>
                            <button
                              title="Correct stock count"
                              onClick={() => setStockFor({ product: p, mode: "adjust" })}
                              className={iconBtn}
                            >
                              <SlidersHorizontal size={16} />
                            </button>
                            <button
                              title="Edit"
                              onClick={() => setProdModal({ open: true, product: p })}
                              className={iconBtn}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              title="Delete"
                              onClick={() => removeProduct(p)}
                              className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                            >
                              <Trash2 size={16} />
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

      {/* ---------------- Equipment ---------------- */}
      {tab === "equipment" && (
        <>
          <div className="card flex flex-wrap items-center gap-3 p-5">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                placeholder="Search by name, brand or serial number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-lux !py-2.5 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "active", label: "In use" },
                  { key: "attention", label: `Needs attention (${attentionCount})` },
                  { key: "retired", label: "Retired" },
                ] as { key: EquipFilter; label: string }[]
              ).map((f) => (
                <button key={f.key} onClick={() => setEquipFilter(f.key)} className={chip(equipFilter === f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {equipRows.length === 0 ? (
            <div className="card grid place-items-center p-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <Dumbbell size={24} />
              </div>
              <p className="mt-4 font-display text-xl">
                {equipment.length === 0 ? "No equipment yet" : "No equipment found"}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted">
                {equipment.length === 0
                  ? 'Click "Add Equipment" to register your machines and track their service.'
                  : "Try a different search, filter or branch."}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {equipRows.map((e) => {
                const st = EQUIP_STATUS[e.status];
                const svc = serviceInfo(e);
                const warrantyOver = !!e.warrantyUntil && e.warrantyUntil < today;
                return (
                  <div
                    key={e.id}
                    className={`card flex flex-col p-6 transition hover:-translate-y-1 hover:border-gold/40 ${
                      e.status === "retired" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg font-semibold">
                          <Link to={`/app/inventory/equipment/${e.id}`} className="hover:underline">
                            {e.name}
                          </Link>
                        </p>
                        <p className="text-xs text-muted">
                          {e.category}
                          {e.brand ? ` · ${e.brand}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 text-sm text-muted">
                      <p>{e.branchName}</p>
                      {e.serialNo && <p>Serial: {e.serialNo}</p>}
                      {e.purchaseDate && (
                        <p>
                          Bought {fmtDate(e.purchaseDate)}
                          {e.purchasePrice > 0 ? ` for ${rupee(e.purchasePrice)}` : ""}
                        </p>
                      )}
                      {e.warrantyUntil && (
                        <p className={warrantyOver ? "text-red-600" : ""}>
                          {warrantyOver ? "Warranty ended" : "Warranty until"} {fmtDate(e.warrantyUntil)}
                        </p>
                      )}
                      <p className={svc.cls}>{svc.text}</p>
                      {e.lastServiceDate && <p>Last service {fmtDate(e.lastServiceDate)}</p>}
                    </div>

                    {e.notes && <p className="mt-3 text-sm text-muted">{e.notes}</p>}

                    <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
                      <button
                        onClick={() => setMaintFor(e)}
                        className="flex items-center gap-1.5 rounded-lg bg-gold/15 px-3.5 py-1.5 text-xs font-medium text-gold-soft transition hover:bg-gold/25"
                      >
                        <Wrench size={13} /> Maintenance
                      </button>
                      <div className="flex gap-1">
                        <Link
                          to={`/app/inventory/equipment/${e.id}`}
                          title="View details"
                          className={iconBtn}
                        >
                          <Eye size={16} />
                        </Link>
                        <button
                          title="Edit"
                          onClick={() => setEqModal({ open: true, item: e })}
                          className={iconBtn}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => removeEquipment(e)}
                          className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---------------- Suppliers ---------------- */}
      {tab === "suppliers" &&
        (suppliers.length === 0 ? (
          <div className="card grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
              <Truck size={24} />
            </div>
            <p className="mt-4 font-display text-xl">No suppliers yet</p>
            <p className="mt-1 max-w-md text-sm text-muted">
              Add the vendors you buy products from, then link them to your products.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {suppliers.map((s) => {
              const count = products.filter((p) => p.supplierId === s.id).length;
              return (
                <div
                  key={s.id}
                  className="card flex flex-col p-6 transition hover:-translate-y-1 hover:border-gold/40"
                >
                  <p className="font-display text-lg font-semibold">{s.name}</p>
                  {s.contactName && <p className="text-sm text-muted">{s.contactName}</p>}

                  <div className="mt-4 space-y-1.5 text-sm text-muted">
                    {s.phone && <p>{s.phone}</p>}
                    {s.email && <p className="break-all">{s.email}</p>}
                    {s.notes && <p>{s.notes}</p>}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
                    <span className="text-sm text-muted">
                      {count} product{count === 1 ? "" : "s"}
                    </span>
                    <div className="flex gap-1">
                      <button
                        title="Edit"
                        onClick={() => setSupModal({ open: true, supplier: s })}
                        className={iconBtn}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => removeSupplier(s)}
                        className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* ---------------- History ---------------- */}
      {tab === "history" && (
        <div className="card overflow-hidden">
          <div className="p-6 pb-4">
            <h3 className="font-display text-xl">Stock History</h3>
            <p className="text-sm text-muted">Latest 200 stock movements</p>
          </div>
          {moves.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted">No stock movements yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                    <th className="px-6 py-3 font-medium">When</th>
                    <th className="px-6 py-3 font-medium">Product</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Change</th>
                    <th className="px-6 py-3 font-medium">Balance</th>
                    <th className="px-6 py-3 font-medium">Details</th>
                    <th className="px-6 py-3 font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id} className="border-b border-line/60 last:border-0">
                      <td className="whitespace-nowrap px-6 py-3 text-muted">{when(m)}</td>
                      <td className="px-6 py-3 font-medium">
                        <Link to={`/app/inventory/products/${m.itemId}`} className="hover:underline">
                          {m.itemName}
                        </Link>
                      </td>
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
      )}

      {/* ---------------- Modals ---------------- */}
      {prodModal.open && (
        <ProductModal
          key={prodModal.product?.id ?? "new"}
          product={prodModal.product}
          suppliers={suppliers}
          onClose={() => setProdModal({ open: false, product: null })}
          onSave={saveProduct}
        />
      )}

      {stockFor && businessId && (
        <StockModal
          key={`${stockFor.product.id}-${stockFor.mode}`}
          businessId={businessId}
          product={stockFor.product}
          mode={stockFor.mode}
          by={actor}
          onClose={() => setStockFor(null)}
        />
      )}

      {sellFor && businessId && (
        <SellModal
          key={sellFor.id}
          businessId={businessId}
          product={sellFor}
          members={members}
          by={actor}
          onClose={() => setSellFor(null)}
        />
      )}

      {supModal.open && (
        <SupplierModal
          key={supModal.supplier?.id ?? "new"}
          supplier={supModal.supplier}
          onClose={() => setSupModal({ open: false, supplier: null })}
          onSave={saveSupplier}
        />
      )}

      {eqModal.open && (
        <EquipmentModal
          key={eqModal.item?.id ?? "new"}
          item={eqModal.item}
          branches={activeBranches}
          defaultBranchId={
            branchId !== "all" && activeBranches.some((b) => b.id === branchId)
              ? branchId
              : (activeBranches[0]?.id ?? "")
          }
          onClose={() => setEqModal({ open: false, item: null })}
          onSave={saveEquipment}
        />
      )}

      {maintFor && businessId && (
        <MaintenanceModal
          key={maintFor.id}
          businessId={businessId}
          item={maintFor}
          logs={logs.filter((l) => l.equipmentId === maintFor.id)}
          by={actor}
          onClose={() => setMaintFor(null)}
        />
      )}
    </div>
  );
}
