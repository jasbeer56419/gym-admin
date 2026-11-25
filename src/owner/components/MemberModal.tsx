import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Branch, Gender, Member, MemberInput } from "../../types";

const GOALS = [
  "General fitness",
  "Weight loss",
  "Muscle gain",
  "Strength",
  "Flexibility",
  "Rehabilitation",
  "Sports performance",
];

const SOURCES = [
  "Walk-in",
  "Referral",
  "Social media",
  "Website",
  "Advertisement",
  "Other",
];

type Props = {
  member: Member | null; // null = register a new member
  initial?: Partial<MemberInput>; // prefill for a new member (e.g. from a lead)
  branches: Branch[]; // active branches only
  defaultBranchId: string;
  onClose: () => void;
  onSave: (data: MemberInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function MemberModal({
  member,
  initial,
  branches,
  defaultBranchId,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<MemberInput>({
    name: member?.name ?? initial?.name ?? "",
    phone: member?.phone ?? initial?.phone ?? "",
    email: member?.email ?? initial?.email ?? "",
    gender: member?.gender ?? "",
    dob: member?.dob ?? "",
    address: member?.address ?? "",
    emergencyName: member?.emergencyName ?? "",
    emergencyPhone: member?.emergencyPhone ?? "",
    goal: member?.goal ?? initial?.goal ?? "General fitness",
    source: member?.source ?? initial?.source ?? "Walk-in",
    notes: member?.notes ?? initial?.notes ?? "",
    branchId: member?.branchId ?? initial?.branchId ?? defaultBranchId,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof MemberInput>(key: K, value: MemberInput[K]) =>
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
        address: form.address.trim(),
        emergencyName: form.emergencyName.trim(),
        emergencyPhone: form.emergencyPhone.trim(),
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
        className="card relative my-8 w-full max-w-3xl !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">
          {member ? "Edit" : "New"} Member
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {member ? "Update Member Profile" : "Register a New Member"}
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
            <label className={label}>Home Branch</label>
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
            <label className={label}>Gender</label>
            <select
              className={field}
              value={form.gender}
              onChange={(e) => set("gender", e.target.value as Gender)}
            >
              <option value="">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className={label}>Date of Birth</label>
            <input
              type="date"
              className={field}
              value={form.dob}
              onChange={(e) => set("dob", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Fitness Goal</label>
            <select
              className={field}
              value={form.goal}
              onChange={(e) => set("goal", e.target.value)}
            >
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>How did they find you?</label>
            <select
              className={field}
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Address</label>
            <input
              className={field}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Emergency Contact Name</label>
            <input
              className={field}
              value={form.emergencyName}
              onChange={(e) => set("emergencyName", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Emergency Contact Phone</label>
            <input
              className={field}
              inputMode="tel"
              value={form.emergencyPhone}
              onChange={(e) => set("emergencyPhone", e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Notes (medical conditions, preferences...)</label>
            <textarea
              rows={3}
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

        {!member && (
          <p className="mt-4 text-xs text-muted">
            After saving, you can assign a membership and collect the first payment.
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
            {busy ? "Saving..." : member ? "Update Member" : "Register Member"}
          </button>
        </div>
      </form>
    </div>
  );
}
