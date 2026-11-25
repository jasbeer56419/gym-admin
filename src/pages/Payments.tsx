import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  IndianRupee,
  Plus,
  Search,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { db } from "../firebase";
import type { Payment, PaymentInput, PaymentStatus } from "../types";
import PaymentModal from "../components/PaymentModal";
import InvoiceModal from "../components/InvoiceModal";

type Filter = "all" | PaymentStatus;

const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const fmtDate = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const badge: Record<PaymentStatus, string> = {
  paid: "bg-emerald-500/10 text-emerald-700",
  pending: "bg-amber-500/10 text-amber-700",
  failed: "bg-red-500/10 text-red-700",
  refunded: "bg-slate-500/10 text-slate-600",
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [invoice, setInvoice] = useState<Payment | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "payments"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Payment);
        // Newest date first, and newest entry first within the same date
        list.sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
        );
        setPayments(list);
        setLoading(false);
      },
      () => {
        setLoadError("Could not load payments. Please check your Firestore rules.");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Next invoice number: INV-2026-0001, INV-2026-0002 ...
  const nextInvoiceNo = () => {
    const year = new Date().getFullYear();
    const nums = payments.map((p) => {
      const m = p.invoiceNo.match(/^INV-(\d{4})-(\d+)$/);
      return m && Number(m[1]) === year ? Number(m[2]) : 0;
    });
    return `INV-${year}-${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`;
  };

  const stats = useMemo(() => {
    const month = todayStr().slice(0, 7); // "2026-10"
    const sum = (list: Payment[]) => list.reduce((s, p) => s + p.amount, 0);
    const paid = payments.filter((p) => p.status === "paid");
    return {
      collected: sum(paid),
      thisMonth: sum(paid.filter((p) => p.date.startsWith(month))),
      pending: sum(payments.filter((p) => p.status === "pending")),
      pendingCount: payments.filter((p) => p.status === "pending").length,
      refunded: sum(payments.filter((p) => p.status === "refunded")),
    };
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      const okStatus = filter === "all" || p.status === filter;
      const okSearch =
        !q ||
        p.businessName.toLowerCase().includes(q) ||
        p.invoiceNo.toLowerCase().includes(q);
      return okStatus && okSearch;
    });
  }, [payments, search, filter]);

  const handleSave = async (data: PaymentInput) => {
    await addDoc(collection(db, "payments"), { ...data, createdAt: serverTimestamp() });
  };

  const markPaid = async (p: Payment) => {
    await updateDoc(doc(db, "payments", p.id), { status: "paid", date: todayStr() });
  };

  const refund = async (p: Payment) => {
    if (window.confirm(`Mark ${p.invoiceNo} (${rupee(p.amount)}) as refunded?`)) {
      await updateDoc(doc(db, "payments", p.id), { status: "refunded" });
    }
  };

  const remove = async (p: Payment) => {
    if (window.confirm(`Delete ${p.invoiceNo}? This cannot be undone.`)) {
      await deleteDoc(doc(db, "payments", p.id));
    }
  };

  const cards = [
    {
      label: "Total Collected",
      value: rupee(stats.collected),
      sub: "All paid money so far",
      icon: Wallet,
    },
    {
      label: "This Month",
      value: rupee(stats.thisMonth),
      sub: "Collected this month",
      icon: IndianRupee,
    },
    {
      label: "Pending",
      value: rupee(stats.pending),
      sub: `${stats.pendingCount} invoice(s) pending`,
      icon: Clock,
    },
    {
      label: "Refunded",
      value: rupee(stats.refunded),
      sub: "Returned to businesses",
      icon: Undo2,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Billing</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Payments & <span className="gold-text">Invoices</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            A complete record of the money received from gym businesses, and their invoices.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="btn-gold flex items-center gap-2 px-5 py-3 text-sm"
        >
          <Plus size={18} /> Record Payment
        </button>
      </div>

      {/* Summary cards */}
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

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              placeholder="Search by business or invoice number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-lux !py-2.5 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "paid", "pending", "failed", "refunded"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg border px-4 py-2 text-sm capitalize transition ${
                  filter === f
                    ? "border-gold/50 bg-gold/15 text-gold-soft"
                    : "border-line text-muted hover:text-charcoal"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center p-16">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
          </div>
        ) : loadError ? (
          <p className="p-10 text-center text-sm text-red-700">{loadError}</p>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
              <CreditCard size={24} />
            </div>
            <p className="mt-4 font-display text-xl">
              {payments.length === 0 ? "No payments yet" : "No matches found"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {payments.length === 0
                ? "Click \"Record Payment\" above to record the first payment."
                : "Try changing the search or filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-4 font-medium">Invoice</th>
                  <th className="px-6 py-4 font-medium">Business</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-line/60 transition last:border-0 hover:bg-gold/5"
                  >
                    <td className="px-6 py-4 font-medium">{p.invoiceNo}</td>
                    <td className="px-6 py-4">
                      <p>{p.businessName}</p>
                      <p className="text-xs text-muted">{p.ownerName}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs text-gold-soft">
                        {p.plan}
                      </span>
                      <span className="ml-2 text-xs capitalize text-muted">{p.cycle}</span>
                    </td>
                    <td className="px-6 py-4 font-medium">{rupee(p.amount)}</td>
                    <td className="px-6 py-4 text-muted">{p.method}</td>
                    <td className="px-6 py-4 text-muted">{fmtDate(p.date)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs capitalize ${badge[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          title="View invoice"
                          onClick={() => setInvoice(p)}
                          className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                        >
                          <FileText size={16} />
                        </button>
                        {(p.status === "pending" || p.status === "failed") && (
                          <button
                            title="Mark as paid"
                            onClick={() => markPaid(p)}
                            className="rounded-lg p-2 text-muted transition hover:bg-emerald-500/10 hover:text-emerald-700"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        {p.status === "paid" && (
                          <button
                            title="Refund"
                            onClick={() => refund(p)}
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            <Undo2 size={16} />
                          </button>
                        )}
                        <button
                          title="Delete"
                          onClick={() => remove(p)}
                          className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <PaymentModal
          invoiceNo={nextInvoiceNo()}
          onClose={() => setAddOpen(false)}
          onSave={handleSave}
        />
      )}

      {invoice && <InvoiceModal payment={invoice} onClose={() => setInvoice(null)} />}
    </div>
  );
}
