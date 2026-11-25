import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Supplier, SupplierInput } from "../inventoryTypes";

type Props = {
  supplier: Supplier | null; // null = add a new supplier
  onClose: () => void;
  onSave: (data: SupplierInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function SupplierModal({ supplier, onClose, onSave }: Props) {
  const [form, setForm] = useState<SupplierInput>({
    name: supplier?.name ?? "",
    contactName: supplier?.contactName ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    notes: supplier?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
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
          {supplier ? "Edit" : "New"} Supplier
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {supplier ? "Update Supplier" : "Add a Supplier"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Supplier Name</label>
            <input
              className={field}
              placeholder="e.g. FitFuel Distributors"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Contact Person</label>
            <input
              className={field}
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Phone</label>
            <input
              className={field}
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Email (optional)</label>
            <input
              type="email"
              className={field}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Notes (optional)</label>
            <textarea
              rows={3}
              className={`${field} resize-none`}
              placeholder="Payment terms, delivery days..."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
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
            {busy ? "Saving..." : supplier ? "Update Supplier" : "Add Supplier"}
          </button>
        </div>
      </form>
    </div>
  );
}