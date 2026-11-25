import { useEffect, useState, type FormEvent } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { X } from "lucide-react";
import { db } from "../firebase";
import type { Business, BusinessInput } from "../types";

type Props = {
  business: Business | null; // null = add new, otherwise edit
  onClose: () => void;
  onSave: (data: BusinessInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function BusinessModal({ business, onClose, onSave }: Props) {
  const [form, setForm] = useState<BusinessInput>({
    name: business?.name ?? "",
    ownerName: business?.ownerName ?? "",
    ownerEmail: business?.ownerEmail ?? "",
    phone: business?.phone ?? "",
    city: business?.city ?? "",
    plan: business?.plan ?? "",
    branches: business?.branches ?? 1,
    status: business?.status ?? "active",
  });
  const [planNames, setPlanNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Load the active plans from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "plans"), (snap) => {
      const rows = snap.docs
        .map((d) => d.data() as { name: string; status: string; priceMonthly: number })
        .filter((p) => p.status === "active")
        .sort((a, b) => a.priceMonthly - b.priceMonthly);
      const names = rows.map((r) => r.name);
      setPlanNames(names);
      // For a new business with no plan yet, select the first plan
      setForm((f) => (f.plan ? f : { ...f, plan: names[0] ?? "" }));
    });
    return unsub;
  }, []);

  // If the old plan is now inactive or missing, still show it in the dropdown
  const options = Array.from(new Set([...planNames, ...(form.plan ? [form.plan] : [])]));

  const set = <K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSave(form);
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

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">
          {business ? "Edit" : "New"} Business
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {business ? "Update Business" : "Add a New Gym Business"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Business Name</label>
            <input
              className={field}
              placeholder="e.g. FitZone Fitness Pvt. Ltd."
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Owner Name</label>
            <input
              className={field}
              value={form.ownerName}
              onChange={(e) => set("ownerName", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Owner Email</label>
            <input
              type="email"
              className={field}
              value={form.ownerEmail}
              onChange={(e) => set("ownerEmail", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Phone</label>
            <input
              className={field}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>City</label>
            <input
              className={field}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Plan</label>
            <select
              className={field}
              value={form.plan}
              onChange={(e) => set("plan", e.target.value)}
              required
            >
              {options.length === 0 && <option value="">Create plans first</option>}
              {options.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Branches</label>
            <input
              type="number"
              min={1}
              className={field}
              value={form.branches}
              onChange={(e) => set("branches", Number(e.target.value))}
              required
            />
          </div>
        </div>

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
            {busy ? "Saving..." : business ? "Update" : "Add Business"}
          </button>
        </div>
      </form>
    </div>
  );
}
