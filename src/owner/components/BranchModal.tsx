import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Branch, BranchInput } from "../../types";

const FACILITIES = [
  "Cardio zone",
  "Strength zone",
  "Free weights",
  "Functional training",
  "Group classes",
  "Personal training",
  "Yoga studio",
  "Swimming pool",
  "Steam & sauna",
  "Locker room",
  "Shower",
  "Parking",
  "Juice bar",
];

const WEEKLY_OFF = [
  "No weekly off",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type Props = {
  branch: Branch | null; // null = add a new branch
  onClose: () => void;
  onSave: (data: BranchInput) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function BranchModal({ branch, onClose, onSave }: Props) {
  const [form, setForm] = useState<BranchInput>({
    name: branch?.name ?? "",
    code: branch?.code ?? "",
    address: branch?.address ?? "",
    city: branch?.city ?? "",
    phone: branch?.phone ?? "",
    email: branch?.email ?? "",
    managerName: branch?.managerName ?? "",
    openTime: branch?.openTime ?? "06:00",
    closeTime: branch?.closeTime ?? "22:00",
    weeklyOff: branch?.weeklyOff ?? "No weekly off",
    facilities: branch?.facilities ?? [],
    status: branch?.status ?? "active",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof BranchInput>(key: K, value: BranchInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleFacility = (name: string) =>
    setForm((f) => ({
      ...f,
      facilities: f.facilities.includes(name)
        ? f.facilities.filter((x) => x !== name)
        : [...f.facilities, name],
    }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        managerName: form.managerName.trim(),
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
          {branch ? "Edit" : "New"} Branch
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {branch ? "Update Branch" : "Add a New Branch"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Branch Name</label>
            <input
              className={field}
              placeholder="e.g. City Center"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Branch Code</label>
            <input
              className={field}
              placeholder="e.g. CC"
              maxLength={6}
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Address</label>
            <input
              className={field}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>City</label>
            <input
              className={field}
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Branch Manager</label>
            <input
              className={field}
              value={form.managerName}
              onChange={(e) => set("managerName", e.target.value)}
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
            <label className={label}>Email</label>
            <input
              type="email"
              className={field}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Opening Time</label>
            <input
              type="time"
              className={field}
              value={form.openTime}
              onChange={(e) => set("openTime", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Closing Time</label>
            <input
              type="time"
              className={field}
              value={form.closeTime}
              onChange={(e) => set("closeTime", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Weekly Off</label>
            <select
              className={field}
              value={form.weeklyOff}
              onChange={(e) => set("weeklyOff", e.target.value)}
            >
              {WEEKLY_OFF.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
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

          <div className="sm:col-span-2">
            <label className={label}>Facilities</label>
            <div className="flex flex-wrap gap-2">
              {FACILITIES.map((f) => {
                const on = form.facilities.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFacility(f)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
                      on
                        ? "border-gold/60 bg-gold/20 text-gold-soft"
                        : "border-line text-muted hover:text-charcoal"
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
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
            {busy ? "Saving..." : branch ? "Update Branch" : "Add Branch"}
          </button>
        </div>
      </form>
    </div>
  );
}