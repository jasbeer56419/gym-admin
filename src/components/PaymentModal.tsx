import { useEffect, useState, type FormEvent } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { X } from "lucide-react";
import { db } from "../firebase";
import type { Business, BillingCycle, PaymentInput, PaymentStatus, Plan } from "../types";

type Props = {
  invoiceNo: string;
  onClose: () => void;
  onSave: (data: PaymentInput) => Promise<void>;
};

const METHODS = ["UPI", "Card", "Net Banking", "Bank Transfer", "Cash", "Cheque"];

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

// Today's date as YYYY-MM-DD (in your local time)
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

export default function PaymentModal({ invoiceNo, onClose, onSave }: Props) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState({
    businessId: "",
    cycle: "monthly" as BillingCycle,
    amount: 0,
    method: "UPI",
    status: "paid" as PaymentStatus,
    date: today(),
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubB = onSnapshot(collection(db, "businesses"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Business);
      list.sort((a, b) => a.name.localeCompare(b.name));
      setBusinesses(list);
    });
    const unsubP = onSnapshot(collection(db, "plans"), (snap) => {
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Plan));
    });
    return () => {
      unsubB();
      unsubP();
    };
  }, []);

  // Plan price based on the business and the billing cycle
  const priceFor = (businessId: string, cycle: BillingCycle) => {
    const b = businesses.find((x) => x.id === businessId);
    const p = plans.find((x) => x.name === b?.plan);
    if (!p) return 0;
    return cycle === "monthly" ? p.priceMonthly : p.priceYearly;
  };

  const pickBusiness = (id: string) =>
    setForm((f) => ({ ...f, businessId: id, amount: priceFor(id, f.cycle) }));

  const pickCycle = (cycle: BillingCycle) =>
    setForm((f) => ({ ...f, cycle, amount: priceFor(f.businessId, cycle) }));

  const selected = businesses.find((b) => b.id === form.businessId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setBusy(true);
    try {
      await onSave({
        invoiceNo,
        businessId: selected.id,
        businessName: selected.name,
        ownerName: selected.ownerName,
        ownerEmail: selected.ownerEmail,
        plan: selected.plan,
        cycle: form.cycle,
        amount: form.amount,
        method: form.method,
        status: form.status,
        date: form.date,
        note: form.note.trim(),
      });
      onClose();
    } catch {
      setError("Could not save. Check your internet connection or Firestore rules.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="card relative my-8 w-full max-w-2xl !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">New Payment</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Record a Payment</h2>
        <p className="mt-1 text-sm text-muted">
          Invoice number: <b className="text-charcoal">{invoiceNo}</b>
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Business</label>
            <select
              className={field}
              value={form.businessId}
              onChange={(e) => pickBusiness(e.target.value)}
              required
            >
              <option value="">
                {businesses.length === 0 ? "Add a business first" : "Choose a business..."}
              </option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.plan})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Billing Cycle</label>
            <select
              className={field}
              value={form.cycle}
              onChange={(e) => pickCycle(e.target.value as BillingCycle)}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label className={label}>Amount (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
              required
            />
          </div>

          <div>
            <label className={label}>Payment Method</label>
            <select
              className={field}
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Status</label>
            <select
              className={field}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as PaymentStatus }))
              }
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className={label}>Date</label>
            <input
              type="date"
              className={field}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className={label}>Note (optional)</label>
            <input
              className={field}
              placeholder="e.g. UPI ref no."
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>

        {selected && form.amount === 0 && (
          <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-gold-soft">
            The price of the "{selected.plan}" plan was not found (the plan may have been
            deleted). Please enter the amount yourself.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:text-charcoal"
          >
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-gold px-6 py-2.5 text-sm">
            {busy ? "Saving..." : "Save Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
