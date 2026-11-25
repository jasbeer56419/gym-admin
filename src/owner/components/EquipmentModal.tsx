import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Branch } from "../../types";
import type { Equipment, EquipmentInput, EquipmentStatus } from "../inventoryTypes";

const CATEGORIES = [
  "Treadmill",
  "Cycle",
  "Elliptical",
  "Strength machine",
  "Free weights",
  "Bench / Rack",
  "Cable machine",
  "Other",
];

const STATUSES: { value: EquipmentStatus; label: string }[] = [
  { value: "working", label: "Working" },
  { value: "maintenance", label: "Under maintenance" },
  { value: "out_of_order", label: "Out of order" },
  { value: "retired", label: "Retired" },
];

type Props = {
  item: Equipment | null; // null = add new equipment
  branches: Branch[]; // active branches only
  defaultBranchId: string;
  onClose: () => void;
  onSave: (data: EquipmentInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function EquipmentModal({ item, branches, defaultBranchId, onClose, onSave }: Props) {
  const [form, setForm] = useState<EquipmentInput>({
    name: item?.name ?? "",
    category: item?.category ?? "Treadmill",
    brand: item?.brand ?? "",
    serialNo: item?.serialNo ?? "",
    branchId: item?.branchId ?? defaultBranchId,
    purchaseDate: item?.purchaseDate ?? "",
    purchasePrice: item?.purchasePrice ?? 0,
    warrantyUntil: item?.warrantyUntil ?? "",
    serviceEveryDays: item?.serviceEveryDays ?? 90,
    lastServiceDate: item?.lastServiceDate ?? "",
    status: item?.status ?? "working",
    notes: item?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof EquipmentInput>(key: K, value: EquipmentInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.branchId) {
      setError("Please select a branch.");
      return;
    }
    if (form.serviceEveryDays < 0 || !Number.isInteger(form.serviceEveryDays)) {
      setError("The service interval must be a whole number of days (0 = no regular service).");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        category: form.category.trim(),
        brand: form.brand.trim(),
        serialNo: form.serialNo.trim(),
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
          {item ? "Edit" : "New"} Equipment
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {item ? "Update Equipment" : "Add Equipment"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Name</label>
            <input
              className={field}
              placeholder="e.g. Treadmill T-200"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Category</label>
            <input
              className={field}
              list="equipment-categories"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            />
            <datalist id="equipment-categories">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={label}>Brand</label>
            <input
              className={field}
              value={form.brand}
              onChange={(e) => set("brand", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Serial Number</label>
            <input
              className={field}
              value={form.serialNo}
              onChange={(e) => set("serialNo", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Branch</label>
            <select
              className={field}
              value={form.branchId}
              onChange={(e) => set("branchId", e.target.value)}
              required
            >
              <option value="">Select a branch...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Status</label>
            <select
              className={field}
              value={form.status}
              onChange={(e) => set("status", e.target.value as EquipmentStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Purchase Date</label>
            <input
              type="date"
              className={field}
              value={form.purchaseDate}
              onChange={(e) => set("purchaseDate", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Purchase Price (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.purchasePrice}
              onChange={(e) => set("purchasePrice", Number(e.target.value))}
            />
          </div>

          <div>
            <label className={label}>Warranty Until</label>
            <input
              type="date"
              className={field}
              value={form.warrantyUntil}
              onChange={(e) => set("warrantyUntil", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Service Every (days)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.serviceEveryDays}
              onChange={(e) => set("serviceEveryDays", Number(e.target.value))}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Last Service Date (optional)</label>
            <input
              type="date"
              className={field}
              value={form.lastServiceDate}
              onChange={(e) => set("lastServiceDate", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">
              The next service date is worked out from this date (or the purchase date) plus the
              service interval. Enter 0 days if the machine needs no regular service.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Notes (optional)</label>
            <textarea
              rows={2}
              className={`${field} resize-none`}
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
            {busy ? "Saving..." : item ? "Update Equipment" : "Add Equipment"}
          </button>
        </div>
      </form>
    </div>
  );
}