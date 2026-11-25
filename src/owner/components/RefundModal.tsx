import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { arrayUnion, doc, increment, runTransaction } from "firebase/firestore";
import { X } from "lucide-react";
import { db } from "../../firebase";
import type { MemberPayment } from "../../types";
import { fmtDate, rupee, todayStr } from "../utils";
import { useActor } from "../useActor";

type Props = {
  businessId: string;
  payment: MemberPayment;
  onClose: () => void;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function RefundModal({ businessId, payment, onClose }: Props) {
  const actor = useActor();
  const refundable = payment.amount - (payment.refundedAmount ?? 0);

  const [amount, setAmount] = useState(refundable);
  const [date, setDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (amount <= 0 || amount > refundable) {
      setError(`Enter an amount between ₹1 and ${rupee(refundable)}.`);
      return;
    }
    if (!reason.trim()) {
      setError("Please enter a reason for the refund.");
      return;
    }

    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const payRef = doc(db, "businesses", businessId, "payments", payment.id);
        const msRef = doc(db, "businesses", businessId, "memberships", payment.membershipId);

        const [p, ms] = await Promise.all([tx.get(payRef), tx.get(msRef)]);
        if (!p.exists()) throw new Error("This payment no longer exists.");

        const remaining = (p.data().amount ?? 0) - (p.data().refundedAmount ?? 0);
        if (amount > remaining) {
          throw new Error(`Only ${rupee(remaining)} can still be refunded.`);
        }

        tx.update(payRef, {
          refundedAmount: increment(amount),
         
             refunds: arrayUnion({ amount, date, reason: reason.trim(), by: actor.name }),
        });

        // The refunded money is no longer owed, so paid and total both go down
        if (ms.exists()) {
          tx.update(msRef, {
            paid: increment(-amount),
            total: increment(-amount),
            refunded: increment(amount),
          });
        }
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
        className="card relative my-8 w-full max-w-md !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Billing</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Refund Payment</h2>

        <div className="mt-5 rounded-xl bg-black/[0.03] p-4 text-sm">
          <p className="font-medium">
            {payment.invoiceNo} · {payment.memberName}
          </p>
          <p className="text-muted">
            {payment.planName} · {fmtDate(payment.date)} · {payment.method}
          </p>
          <p className="mt-2">
            Paid <b>{rupee(payment.amount)}</b>
            {(payment.refundedAmount ?? 0) > 0 && (
              <>
                {" "}
                · Already refunded <b>{rupee(payment.refundedAmount ?? 0)}</b>
              </>
            )}
          </p>
        </div>

        <div className="mt-5 grid gap-4">
          <div>
            <label className={label}>Refund Amount (₹)</label>
            <input
              type="number"
              min={1}
              max={refundable}
              className={field}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
            />
            <p className="mt-1 text-xs text-muted">You can refund up to {rupee(refundable)}.</p>
          </div>

          <div>
            <label className={label}>Refund Date</label>
            <input
              type="date"
              className={field}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Reason</label>
            <input
              className={field}
              placeholder="e.g. Member relocated"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
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
            {busy ? "Saving..." : "Confirm Refund"}
          </button>
        </div>
      </form>
    </div>
  );
}