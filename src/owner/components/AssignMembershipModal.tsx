import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { X } from "lucide-react";
import { db } from "../../firebase";
import type { Member, MembershipPlan } from "../../types";
   import { useActor } from "../useActor";
import { addDays, durationLabel, endDateFor, fmtDate, rupee, todayStr } from "../utils";

export type AssignMode = "new" | "renew" | "upgrade";

const METHODS = ["Cash", "UPI", "Card", "Net Banking", "Bank Transfer", "Cheque"];

const TITLES: Record<AssignMode, string> = {
  new: "Assign Membership",
  renew: "Renew Membership",
  upgrade: "Upgrade or Change Plan",
};

type Props = {
  businessId: string;
  member: Member;
  mode: AssignMode;
  plans: MembershipPlan[];
  onClose: () => void;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function AssignMembershipModal({
  businessId,
  member,
  mode,
  plans,
  onClose,
}: Props) {
     const actor = useActor();
  const today = todayStr();

  // Only plans that can be sold to this member
  const eligible = plans.filter(
    (p) =>
      p.status === "active" &&
      ((p.branchIds ?? []).length === 0 || p.branchIds.includes(member.branchId)) &&
      (!p.isTrial || !member.membershipId)
  );

  const initialPlan =
    (mode === "renew" ? eligible.find((p) => p.id === member.membershipPlanId) : undefined) ??
    eligible[0];

  // Joining fee applies only to a member's very first membership
  const feeFor = (p?: MembershipPlan) =>
    mode === "new" && !member.membershipId && p ? p.joiningFee : 0;

  const defaultStart =
    mode === "renew" && member.membershipEnd && member.membershipEnd >= today
      ? addDays(member.membershipEnd, 1)
      : today;

  const [planId, setPlanId] = useState(initialPlan?.id ?? "");
  const [startDate, setStartDate] = useState(defaultStart);
  const [price, setPrice] = useState(initialPlan?.price ?? 0);
  const [joiningFee, setJoiningFee] = useState(feeFor(initialPlan));
  const [discount, setDiscount] = useState(0);
  const [paidInput, setPaidInput] = useState(0);
  const [paidTouched, setPaidTouched] = useState(false);
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");
  const [replaceCurrent, setReplaceCurrent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = eligible.find((p) => p.id === planId) ?? null;
  const endDate = selected
    ? endDateFor(startDate, selected.durationValue, selected.durationUnit)
    : "";
  const total = Math.max(0, price + joiningFee - discount);
  const paid = paidTouched ? paidInput : total;
  const due = total - paid;

  const pickPlan = (id: string) => {
    const p = eligible.find((x) => x.id === id);
    setPlanId(id);
    setPrice(p?.price ?? 0);
    setJoiningFee(feeFor(p));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selected) {
      setError("Please choose a plan.");
      return;
    }
    if (member.frozen) {
      setError("This membership is frozen. Please unfreeze it first.");
      return;
    }
    if (discount < 0 || discount > price + joiningFee) {
      setError("Discount cannot be negative or more than the amount.");
      return;
    }
    if (paid < 0 || paid > total) {
      setError("Amount received cannot be more than the total.");
      return;
    }

    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const counterRef = doc(db, "businesses", businessId, "meta", "counters");
        const memberRef = doc(db, "businesses", businessId, "members", member.id);

        // Reads must come before writes in a transaction
        let invoiceNo = "";
        if (paid > 0) {
          const c = await tx.get(counterRef);
          const next = (c.exists() ? (c.data().invoiceSeq ?? 0) : 0) + 1;
          tx.set(counterRef, { invoiceSeq: next }, { merge: true });
          invoiceNo = `INV-${String(next).padStart(5, "0")}`;
        }

        const msRef = doc(collection(db, "businesses", businessId, "memberships"));
        tx.set(msRef, {
          memberId: member.id,
          memberName: member.name,
          branchId: member.branchId,
          planId: selected.id,
          planName: selected.name,
          type: mode === "new" ? "new" : mode === "renew" ? "renewal" : "upgrade",
          startDate,
          endDate,
          price,
          joiningFee,
          discount,
          total,
          paid,
          maxFreezeDays: selected.maxFreezeDays,
          freezeDaysUsed: 0,
          status: "active",
             soldById: actor.id,
   soldByName: actor.name,
          createdAt: serverTimestamp(),
        });

        tx.update(memberRef, {
          membershipId: msRef.id,
          membershipPlanId: selected.id,
          membershipPlan: selected.name,
          membershipStart: startDate,
          membershipEnd: endDate,
          frozen: false,
          frozenOn: "",
        });

        if (mode === "upgrade" && replaceCurrent && member.membershipId) {
          tx.update(doc(db, "businesses", businessId, "memberships", member.membershipId), {
            status: "replaced",
            endedOn: today,
          });
        }

        if (paid > 0) {
          tx.set(doc(collection(db, "businesses", businessId, "payments")), {
            invoiceNo,
            memberId: member.id,
            memberName: member.name,
            membershipId: msRef.id,
            planName: selected.name,
            branchId: member.branchId,
            amount: paid,
            method,
            date: today,
            note: note.trim(),
            status: "paid",
            type: "membership",
               collectedById: actor.id,
   collectedByName: actor.name,
   collectedByRole: actor.role,
            createdAt: serverTimestamp(),
          });
        }
      });
      onClose();
    } catch {
      setError("Could not save. Please check your connection and try again.");
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

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Membership</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{TITLES[mode]}</h2>
        <p className="mt-1 text-sm text-muted">
          {member.name} · {member.code}
          {member.membershipEnd && (
            <>
              {" "}
              · Current plan: <b>{member.membershipPlan}</b> until{" "}
              <b>{fmtDate(member.membershipEnd)}</b>
            </>
          )}
        </p>

        {eligible.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gold/30 bg-gold/10 p-6 text-center">
            <p className="font-medium">No membership plan available for this member.</p>
            <p className="mt-1 text-sm text-muted">
              Create an active plan that is valid at this member's branch first.
            </p>
            <Link
              to="/app/memberships"
              onClick={onClose}
              className="btn-gold mt-4 inline-block px-5 py-2 text-sm"
            >
              Go to Membership Plans
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>Plan</label>
                <select
                  className={field}
                  value={planId}
                  onChange={(e) => pickPlan(e.target.value)}
                >
                  {eligible.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {durationLabel(p.durationValue, p.durationUnit)} ·{" "}
                      {rupee(p.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={label}>Start Date</label>
                <input
                  type="date"
                  className={field}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className={label}>End Date (automatic)</label>
                <input
                  className={`${field} cursor-not-allowed opacity-70`}
                  value={endDate ? fmtDate(endDate) : "—"}
                  readOnly
                />
              </div>

              <div>
                <label className={label}>Plan Price (₹)</label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                />
              </div>

              <div>
                <label className={label}>Joining Fee (₹)</label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={joiningFee}
                  onChange={(e) => setJoiningFee(Number(e.target.value))}
                />
              </div>

              <div>
                <label className={label}>Discount (₹)</label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>

              <div className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-muted">Total payable</p>
                <p className="font-display text-2xl font-semibold">{rupee(total)}</p>
              </div>

              <div>
                <label className={label}>Amount Received Now (₹)</label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={paid}
                  onChange={(e) => {
                    setPaidTouched(true);
                    setPaidInput(Number(e.target.value));
                  }}
                />
              </div>

              <div>
                <label className={label}>Payment Method</label>
                <select
                  className={field}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  disabled={paid === 0}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className={label}>Note (optional)</label>
                <input
                  className={field}
                  placeholder="e.g. UPI reference number"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {mode === "upgrade" && member.membershipId && (
                <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={replaceCurrent}
                    onChange={(e) => setReplaceCurrent(e.target.checked)}
                    className="h-4 w-4 accent-[#c9a227]"
                  />
                  <span className="text-sm">
                    End the current membership today (mark it as replaced)
                  </span>
                </label>
              )}
            </div>

            <div className="mt-5 rounded-xl bg-black/[0.03] p-4 text-sm">
              <p>
                This membership runs from <b>{fmtDate(startDate)}</b> to{" "}
                <b>{endDate ? fmtDate(endDate) : "—"}</b>.
              </p>
              {due > 0 && (
                <p className="mt-1 text-red-600">
                  Balance due: <b>{rupee(due)}</b> (it will be shown on the member's profile).
                </p>
              )}
            </div>
          </>
        )}

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
            {mode === "new" ? "Skip for now" : "Cancel"}
          </button>
          {eligible.length > 0 && (
            <button type="submit" disabled={busy} className="btn-gold px-6 py-2.5 text-sm">
              {busy ? "Saving..." : "Confirm Membership"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}