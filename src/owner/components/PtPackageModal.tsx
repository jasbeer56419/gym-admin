import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { PtPackage, PtPackageInput } from "../ptTypes";

type Props = {
  pkg: PtPackage | null; // null = create a new package
  onClose: () => void;
  onSave: (data: PtPackageInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function PtPackageModal({ pkg, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: pkg?.name ?? "",
    description: pkg?.description ?? "",
    sessions: pkg?.sessions ?? 10,
    price: pkg?.price ?? 0,
    validityDays: pkg?.validityDays ?? 60,
    status: (pkg?.status ?? "active") as "active" | "inactive",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.sessions < 1) {
      setError("A package needs at least 1 session.");
      return;
    }
    if (form.validityDays < 1) {
      setError("Validity must be at least 1 day.");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        sessions: form.sessions,
        price: form.price,
        validityDays: form.validityDays,
        status: form.status,
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
        className="card relative my-8 w-full max-w-xl !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">
          {pkg ? "Edit" : "New"} Package
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {pkg ? "Update Training Package" : "Create a Training Package"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Package Name</label>
            <input
              className={field}
              placeholder="e.g. 10 Session Pack"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Number of Sessions</label>
            <input
              type="number"
              min={1}
              className={field}
              value={form.sessions}
              onChange={(e) => set("sessions", Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Price (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Validity (days)</label>
            <input
              type="number"
              min={1}
              className={field}
              value={form.validityDays}
              onChange={(e) => set("validityDays", Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Status</label>
            <select
              className={field}
              value={form.status}
              onChange={(e) => set("status", e.target.value as "active" | "inactive")}
            >
              <option value="active">Active (can be sold)</option>
              <option value="inactive">Inactive (hidden)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Description (optional)</label>
            <input
              className={field}
              placeholder="e.g. One-to-one coaching with a certified trainer"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          The validity starts counting from the day the package is assigned to a member. Sessions
          that are not used by then expire.
        </p>

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
            {busy ? "Saving..." : pkg ? "Update Package" : "Create Package"}
          </button>
        </div>
      </form>
    </div>
  );
}