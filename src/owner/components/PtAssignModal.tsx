import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { X } from "lucide-react";
import { db } from "../../firebase";
import type { Member, StaffMember } from "../../types";
import type { PtPackage } from "../ptTypes";
import { addDays, fmtDate, rupee, todayStr } from "../utils";

type Props = {
  businessId: string;
  members: Member[];
  trainers: StaffMember[]; // active trainers only
  packages: PtPackage[]; // active packages only
  onClose: () => void;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function PtAssignModal({ businessId, members, trainers, packages, onClose }: Props) {
  const live = useMemo(
    () => members.filter((m) => !m.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );

  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [trainerId, setTrainerId] = useState(trainers[0]?.id ?? "");
  const [startDate, setStartDate] = useState(todayStr());
  const [price, setPrice] = useState(packages[0]?.price ?? 0);
  const [paid, setPaid] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const q = search.trim().toLowerCase();
  const shown = live.filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.phone.includes(q) ||
      m.code.toLowerCase().includes(q) ||
      m.id === memberId
  );

  const pkg = packages.find((p) => p.id === packageId) ?? null;
  const expiryDate = pkg ? addDays(startDate, pkg.validityDays - 1) : "";

  const pickPackage = (id: string) => {
    const p = packages.find((x) => x.id === id);
    setPackageId(id);
    setPrice(p?.price ?? 0);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const member = live.find((m) => m.id === memberId);
    const trainer = trainers.find((t) => t.id === trainerId);

    if (!member) {
      setError("Please choose a member.");
      return;
    }
    if (!pkg) {
      setError("Please choose a package.");
      return;
    }
    if (!trainer) {
      setError("Please choose a trainer.");
      return;
    }
    if (paid < 0 || paid > price) {
      setError("Amount received cannot be negative or more than the price.");
      return;
    }

    setBusy(true);
    try {
      await addDoc(collection(db, "businesses", businessId, "ptClients"), {
        memberId: member.id,
        memberName: member.name,
        memberCode: member.code,
        memberPhone: member.phone,
        trainerId: trainer.id,
        trainerName: trainer.name,
        branchId: member.branchId,
        packageId: pkg.id,
        packageName: pkg.name,
        totalSessions: pkg.sessions,
        usedSessions: 0,
        price,
        paid,
        startDate,
        expiryDate,
        status: "active",
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch {
      setError("Could not save. Please check your connection and try again.");
      setBusy(false);
    }
  };

  const blocked = packages.length === 0 || trainers.length === 0;

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

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Personal Training</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Assign a Package</h2>

        {blocked ? (
          <div className="mt-6 rounded-2xl border border-gold/30 bg-gold/10 p-6 text-center">
            <p className="font-medium">You are not ready to assign a package yet.</p>
            <p className="mt-1 text-sm text-muted">
              {packages.length === 0
                ? "Create at least one active training package first."
                : "Add at least one active trainer from Trainers & Staff first."}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label}>Member</label>
              <input
                className={`${field} mb-2`}
                placeholder="Search by name, phone or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className={field}
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                required
              >
                <option value="">
                  {shown.length === 0 ? "No members found" : "Choose a member..."}
                </option>
                {shown.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Package</label>
              <select
                className={field}
                value={packageId}
                onChange={(e) => pickPackage(e.target.value)}
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.sessions} sessions · {rupee(p.price)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Trainer</label>
              <select
                className={field}
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
              >
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
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
              <label className={label}>Valid Until (automatic)</label>
              <input
                className={`${field} cursor-not-allowed opacity-70`}
                value={expiryDate ? fmtDate(expiryDate) : "—"}
                readOnly
              />
            </div>

            <div>
              <label className={label}>Price (₹)</label>
              <input
                type="number"
                min={0}
                className={field}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>

            <div>
              <label className={label}>Amount Received Now (₹)</label>
              <input
                type="number"
                min={0}
                className={field}
                value={paid}
                onChange={(e) => setPaid(Number(e.target.value))}
              />
            </div>

            {price - paid > 0 && (
              <p className="rounded-xl bg-black/[0.03] p-3 text-sm sm:col-span-2">
                Balance due: <b className="text-red-600">{rupee(price - paid)}</b>. You can collect
                it later from the Clients tab.
              </p>
            )}
          </div>
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
            Cancel
          </button>
          {!blocked && (
            <button type="submit" disabled={busy} className="btn-gold px-6 py-2.5 text-sm">
              {busy ? "Saving..." : "Assign Package"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}