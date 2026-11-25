import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Branch, Lead, LeadInput } from "../../types";
import { LEAD_GOALS, LEAD_SOURCES } from "../leadUtils";
import { addDays, todayStr } from "../utils";

type Props = {
  lead: Lead | null; // null = add a new lead
  branches: Branch[]; // active branches only
  defaultBranchId: string;
  onClose: () => void;
  onSave: (data: LeadInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function LeadModal({ lead, branches, defaultBranchId, onClose, onSave }: Props) {
  const [form, setForm] = useState<LeadInput>({
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    source: lead?.source ?? "Walk-in",
    interest: lead?.interest ?? "General fitness",
    branchId: lead?.branchId ?? defaultBranchId,
    nextFollowUp: lead ? lead.nextFollowUp : addDays(todayStr(), 1),
    notes: lead?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.branchId) {
      setError("Please select a branch.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
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
          {lead ? "Edit" : "New"} Lead
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {lead ? "Update Lead" : "Add an Enquiry"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Full Name</label>
            <input
              className={field}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Phone</label>
            <input
              className={field}
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Email (optional)</label>
            <input
              type="email"
              className={field}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
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
            <label className={label}>Source</label>
            <select
              className={field}
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Interested in</label>
            <select
              className={field}
              value={form.interest}
              onChange={(e) => set("interest", e.target.value)}
            >
              {LEAD_GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Next Follow-up Date</label>
            <input
              type="date"
              className={field}
              value={form.nextFollowUp}
              onChange={(e) => set("nextFollowUp", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Notes</label>
            <textarea
              rows={3}
              className={`${field} resize-none`}
              placeholder="Budget, preferred timing, who referred them..."
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
            {busy ? "Saving..." : lead ? "Update Lead" : "Add Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}