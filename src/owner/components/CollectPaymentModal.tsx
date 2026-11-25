import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { X } from "lucide-react";
import { db } from "../../firebase";
import type { Membership } from "../../types";
import { fmtDate, rupee, todayStr } from "../utils";
import { useActor } from "../useActor";

const METHODS = ["Cash", "UPI", "Card", "Net Banking", "Bank Transfer", "Cheque"];

type Props = {
  businessId: string;
  membership: Membership;
  onClose: () => void;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function CollectPaymentModal({ businessId, membership, onClose }: Props) {
  const actor = useActor();
  const due = Math.max(0, membership.total - membership.paid);

  const [amount, setAmount] = useState(due);
  const [method, setMethod] = useState("Cash");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (amount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (amount > due) {
      setError(`The balance due is only ${rupee(due)}.`);
      return;
    }

    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const msRef = doc(db, "businesses", businessId, "memberships", membership.id);
        const counterRef = doc(db, "businesses", businessId, "meta", "counters");

        // Reads first, then writes
        const [ms, counter] = await Promise.all([tx.get(msRef), tx.get(counterRef)]);
        if (!ms.exists()) throw new Error("This membership no longer exists.");

        const dueNow = (ms.data().total ?? 0) - (ms.data().paid ?? 0);
        if (amount > dueNow) {
          throw new Error(`Only ${rupee(Math.max(0, dueNow))} is due on this membership.`);
        }

        const next = (counter.exists() ? (counter.data().invoiceSeq ?? 0) : 0) + 1;
        tx.set(counterRef, { invoiceSeq: next }, { merge: true });

        tx.update(msRef, { paid: increment(amount) });

        tx.set(doc(collection(db, "businesses", businessId, "payments")), {
          invoiceNo: `INV-${String(next).padStart(5, "0")}`,
          memberId: membership.memberId,
          memberName: membership.memberName,
          membershipId: membership.id,
          planName: membership.planName,
          branchId: membership.branchId,
          amount,
          method,
          date,
          note: note.trim(),
          status: "paid",
          type: "due",
             collectedById: actor.id,
   collectedByName: actor.name,
   collectedByRole: actor.role,
          refundedAmount: 0,
          refunds: [],
          createdAt: serverTimestamp(),
        });
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && !(err instanceof FirebaseError)
          ? err.message
          : "Could not save. Please check your connection and try again."
      );
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="card relative my-8 w-full max-w-lg !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Billing</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Collect Payment</h2>

        <div className="mt-5 rounded-xl bg-black/[0.03] p-4 text-sm">
          <p className="font-medium">{membership.memberName}</p>
          <p className="text-muted">
            {membership.planName} · {fmtDate(membership.startDate)} to{" "}
            {fmtDate(membership.endDate)}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted">Total</p>
              <p className="font-semibold">{rupee(membership.total)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Paid</p>
              <p className="font-semibold text-emerald-700">{rupee(membership.paid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Due</p>
              <p className="font-semibold text-red-600">{rupee(due)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Amount (₹)</label>
            <input
              type="number"
              min={1}
              max={due}
              className={field}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Payment Method</label>
            <select
              className={field}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Date</label>
            <input
              type="date"
              className={field}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Note (optional)</label>
            <input
              className={field}
              placeholder="e.g. UPI reference"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:text-charcoal"
          >
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-gold px-6 py-2.5 text-sm">
            {busy ? "Saving..." : "Collect Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}