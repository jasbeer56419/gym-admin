import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type {
  Branch,
  DurationUnit,
  MembershipPlan,
  MembershipPlanInput,
} from "../../types";

const PRESETS: { label: string; value: number; unit: DurationUnit }[] = [
  { label: "7 days", value: 7, unit: "day" },
  { label: "1 month", value: 1, unit: "month" },
  { label: "3 months", value: 3, unit: "month" },
  { label: "6 months", value: 6, unit: "month" },
  { label: "12 months", value: 12, unit: "month" },
];

type Props = {
  plan: MembershipPlan | null; // null = create a new plan
  branches: Branch[];
  onClose: () => void;
  onSave: (data: MembershipPlanInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function MembershipPlanModal({ plan, branches, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    durationValue: plan?.durationValue ?? 1,
    durationUnit: (plan?.durationUnit ?? "month") as DurationUnit,
    price: plan?.price ?? 0,
    joiningFee: plan?.joiningFee ?? 0,
    maxFreezeDays: plan?.maxFreezeDays ?? 0,
    allBranches: !plan || (plan.branchIds ?? []).length === 0,
    branchIds: (plan?.branchIds ?? []) as string[],
    inclusionsText: (plan?.inclusions ?? []).join("\n"),
    isTrial: plan?.isTrial ?? false,
    status: (plan?.status ?? "active") as "active" | "inactive",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleBranch = (id: string) =>
    setForm((f) => ({
      ...f,
      branchIds: f.branchIds.includes(id)
        ? f.branchIds.filter((x) => x !== id)
        : [...f.branchIds, id],
    }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.durationValue < 1) {
      setError("Duration must be at least 1.");
      return;
    }
    if (!form.allBranches && form.branchIds.length === 0) {
      setError("Select at least one branch, or choose \"All branches\".");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim(),
        durationValue: form.durationValue,
        durationUnit: form.durationUnit,
        price: form.price,
        joiningFee: form.joiningFee,
        maxFreezeDays: form.maxFreezeDays,
        branchIds: form.allBranches ? [] : form.branchIds,
        inclusions: form.inclusionsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        isTrial: form.isTrial,
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
          {plan ? "Edit" : "New"} Membership Plan
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {plan ? "Update Plan" : "Create a Membership Plan"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Plan Name</label>
            <input
              className={field}
              placeholder="e.g. Quarterly"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Description (optional)</label>
            <input
              className={field}
              placeholder="Short description shown to staff"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Duration</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const on = form.durationValue === p.value && form.durationUnit === p.unit;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      set("durationValue", p.value);
                      set("durationUnit", p.unit);
                    }}
                    className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
                      on
                        ? "border-gold/60 bg-gold/20 text-gold-soft"
                        : "border-line text-muted hover:text-charcoal"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={1}
                className={field}
                value={form.durationValue}
                onChange={(e) => set("durationValue", Number(e.target.value))}
                required
              />
              <select
                className={field}
                value={form.durationUnit}
                onChange={(e) => set("durationUnit", e.target.value as DurationUnit)}
              >
                <option value="day">Days</option>
                <option value="month">Months</option>
              </select>
            </div>
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
            <label className={label}>Joining Fee (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.joiningFee}
              onChange={(e) => set("joiningFee", Number(e.target.value))}
            />
          </div>

          <div>
            <label className={label}>Max Freeze Days</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.maxFreezeDays}
              onChange={(e) => set("maxFreezeDays", Number(e.target.value))}
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

          <p className="-mt-2 text-xs text-muted sm:col-span-2">
            The joining fee is charged only on a member's first membership. Enter 0 freeze
            days if this plan cannot be frozen.
          </p>

          <div className="sm:col-span-2">
            <label className={label}>Valid at</label>
            <label className="mb-3 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.allBranches}
                onChange={(e) => set("allBranches", e.target.checked)}
                className="h-4 w-4 accent-[#c9a227]"
              />
              <span className="text-sm">All branches</span>
            </label>

            {!form.allBranches && (
              <div className="flex flex-wrap gap-2">
                {branches.length === 0 && (
                  <p className="text-sm text-muted">Add a branch first.</p>
                )}
                {branches.map((b) => {
                  const on = form.branchIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBranch(b.id)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
                        on
                          ? "border-gold/60 bg-gold/20 text-gold-soft"
                          : "border-line text-muted hover:text-charcoal"
                      }`}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Inclusions (one per line)</label>
            <textarea
              rows={4}
              className={`${field} resize-none`}
              placeholder={"Full gym access\nLocker\nSteam & sauna"}
              value={form.inclusionsText}
              onChange={(e) => set("inclusionsText", e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isTrial}
              onChange={(e) => set("isTrial", e.target.checked)}
              className="h-4 w-4 accent-[#c9a227]"
            />
            <span className="text-sm">
              This is a <b>trial plan</b> (only for members who have never had a membership)
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