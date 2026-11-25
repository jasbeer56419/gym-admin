import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Branch, GymClass, GymClassInput, StaffMember } from "../../types";
import { ACTIVITIES, DAYS } from "../classUtils";

type Props = {
  cls: GymClass | null; // null = create a new class
  branches: Branch[]; // active branches only
  trainers: StaffMember[]; // active trainers only
  defaultBranchId: string;
  onClose: () => void;
  onSave: (data: GymClassInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function ClassModal({
  cls,
  branches,
  trainers,
  defaultBranchId,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<GymClassInput>({
    name: cls?.name ?? "",
    description: cls?.description ?? "",
    trainerId: cls?.trainerId ?? "",
    branchId: cls?.branchId ?? defaultBranchId,
    days: cls?.days ?? ["Mon", "Wed", "Fri"],
    startTime: cls?.startTime ?? "07:00",
    endTime: cls?.endTime ?? "08:00",
    capacity: cls?.capacity ?? 20,
    status: cls?.status ?? "active",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof GymClassInput>(key: K, value: GymClassInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleDay = (d: string) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d],
    }));

  // Keep the current trainer in the list even if they were disabled later
  const trainerOptions =
    cls?.trainerId && !trainers.some((t) => t.id === cls.trainerId)
      ? [...trainers, { id: cls.trainerId, name: `${cls.trainerName} (inactive)` } as StaffMember]
      : trainers;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.branchId) {
      setError("Please select a branch.");
      return;
    }
    if (form.days.length === 0) {
      setError("Select at least one day.");
      return;
    }
    if (form.endTime <= form.startTime) {
      setError("The end time must be after the start time.");
      return;
    }
    if (form.capacity < 1) {
      setError("Capacity must be at least 1.");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        days: DAYS.filter((d) => form.days.includes(d)),
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
          {cls ? "Edit" : "New"} Class
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {cls ? "Update Class" : "Create a Class"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Class Name</label>
            <input
              className={field}
              list="activity-list"
              placeholder="e.g. Morning Yoga"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
            <datalist id="activity-list">
              {ACTIVITIES.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={label}>Trainer</label>
            <select
              className={field}
              value={form.trainerId}
              onChange={(e) => set("trainerId", e.target.value)}
            >
              <option value="">No trainer assigned</option>
              {trainerOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
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
            <label className={label}>Capacity (seats)</label>
            <input
              type="number"
              min={1}
              className={field}
              value={form.capacity}
              onChange={(e) => set("capacity", Number(e.target.value))}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Runs on</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = form.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
                      on
                        ? "border-gold/60 bg-gold/20 text-gold-soft"
                        : "border-line text-muted hover:text-charcoal"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={label}>Starts</label>
            <input
              type="time"
              className={field}
              value={form.startTime}
              onChange={(e) => set("startTime", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Ends</label>
            <input
              type="time"
              className={field}
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Description (optional)</label>
            <input
              className={field}
              placeholder="e.g. Beginner friendly, bring your own mat"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Status</label>
            <select
              className={field}
              value={form.status}
              onChange={(e) => set("status", e.target.value as "active" | "inactive")}
            >
              <option value="active">Active (can be booked)</option>
              <option value="inactive">Inactive (hidden)</option>
            </select>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          Changing the time or capacity applies to future bookings. Sheets that already have
          bookings keep the time they were created with.
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
            {busy ? "Saving..." : cls ? "Update Class" : "Create Class"}
          </button>
        </div>
      </form>
    </div>
  );
}