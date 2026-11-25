import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Plan, PlanInput } from "../types";

type Props = {
  plan: Plan | null; // null = new plan, otherwise edit
  onClose: () => void;
  onSave: (data: PlanInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function PlanModal({ plan, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: plan?.name ?? "",
    priceMonthly: plan?.priceMonthly ?? 0,
    priceYearly: plan?.priceYearly ?? 0,
    maxBranches: plan?.maxBranches ?? 1,
    maxMembers: plan?.maxMembers ?? 100,
    maxStaff: plan?.maxStaff ?? 5,
    featuresText: (plan?.features ?? []).join("\n"),
    popular: plan?.popular ?? false,
    status: (plan?.status ?? "active") as "active" | "inactive",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { featuresText, ...rest } = form;
      await onSave({
        ...rest,
        name: rest.name.trim(),
        features: featuresText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
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

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">
          {plan ? "Edit" : "New"} Plan
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {plan ? "Update Plan" : "New Subscription Plan"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Plan Name</label>
            <input
              className={field}
              placeholder="e.g. Premium"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Monthly Price (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.priceMonthly}
              onChange={(e) => set("priceMonthly", Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Yearly Price (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.priceYearly}
              onChange={(e) => set("priceYearly", Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Max Branches</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.maxBranches}
              onChange={(e) => set("maxBranches", Number(e.target.value))}
            />
          </div>

          <div>
            <label className={label}>Max Members</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.maxMembers}
              onChange={(e) => set("maxMembers", Number(e.target.value))}
            />
          </div>

          <div>
            <label className={label}>Max Staff</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.maxStaff}
              onChange={(e) => set("maxStaff", Number(e.target.value))}
            />
          </div>

          <div>
            <label className={label}>Status</label>
            <select
              className={field}
              value={form.status}
              onChange={(e) => set("status", e.target.value as "active" | "inactive")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <p className="-mt-2 text-xs text-muted sm:col-span-2">
            Tip: Entering <b>0</b> in a limit means <b>Unlimited</b>.
          </p>

          <div className="sm:col-span-2">
            <label className={label}>Features (one feature per line)</label>
            <textarea
              rows={6}
              className={`${field} resize-none`}
              placeholder={"Member management\nAttendance tracking\nWhatsApp reminders"}
              value={form.featuresText}
              onChange={(e) => set("featuresText", e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.popular}
              onChange={(e) => set("popular", e.target.checked)}
              className="h-4 w-4 accent-[#c9a227]"
            />
            <span className="text-sm">
              Mark this as <b>"Most Popular"</b> (the card will be highlighted in gold)
            </span>
          </label>
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
            {busy ? "Saving..." : plan ? "Update Plan" : "Create Plan"}
          </button>
        </div>
      </form>
    </div>
  );
}
