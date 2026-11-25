import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Branch, StaffPrivate, StaffRole } from "../../types";
import {
  ACTION_PERMISSIONS,
  ALL_PERMISSIONS,
  MODULE_PERMISSIONS,
  defaultPermissions,
  type PermissionDef,
  type StaffWithPermissions,
} from "../permissions";

export type StaffFormData = {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: StaffRole;
  branchIds: string[];
  specialization: string;
  shiftDays: string[];
  shiftStart: string;
  shiftEnd: string;
  salary: number;
  ptCommission: number;
  classCommission: number;
  joinDate: string;
  notes: string;
  permissions: string[];
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ROLES: { value: StaffRole; label: string; help: string }[] = [
  {
    value: "manager",
    label: "Manager",
    help: "Members, attendance, billing, leads, classes, inventory and reports. Can refund payments. Cannot change settings, plans, branches or staff.",
  },
  {
    value: "receptionist",
    label: "Receptionist (front desk)",
    help: "Members, memberships, attendance, payments, leads and classes. Cannot refund, see reports or change settings.",
  },
  {
    value: "trainer",
    label: "Trainer",
    help: "View-only access to members, plus their own dashboard, classes and personal training. Cannot see payments.",
  },
];

type Props = {
  staff: StaffWithPermissions | null; // null = add new staff
  priv: StaffPrivate | null;
  branches: Branch[]; // active branches only
  onClose: () => void;
  onSave: (data: StaffFormData) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

function PermBox({
  def,
  on,
  needs,
  onToggle,
}: {
  def: PermissionDef;
  on: boolean;
  needs?: string;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white/60 p-3 transition hover:border-gold/40">
      <input
        type="checkbox"
        checked={on}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#c9a227]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{def.label}</span>
        <span className="block text-xs text-muted">
          {def.help}
          {needs ? ` Needs the ${needs} page.` : ""}
        </span>
      </span>
    </label>
  );
}

export default function StaffModal({ staff, priv, branches, onClose, onSave }: Props) {
  const startRole: StaffRole = staff?.role ?? "receptionist";

  const [form, setForm] = useState<StaffFormData>({
    name: staff?.name ?? "",
    email: staff?.email ?? "",
    password: "",
    phone: staff?.phone ?? "",
    role: startRole,
    branchIds: staff?.branchIds ?? [],
    specialization: staff?.specialization ?? "",
    shiftDays: staff?.shift?.days ?? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    shiftStart: staff?.shift?.start ?? "06:00",
    shiftEnd: staff?.shift?.end ?? "14:00",
    salary: priv?.salary ?? 0,
    ptCommission: priv?.ptCommission ?? 0,
    classCommission: priv?.classCommission ?? 0,
    joinDate: priv?.joinDate ?? "",
    notes: priv?.notes ?? "",
    permissions: staff?.permissions ?? defaultPermissions(startRole),
  });
  const [allBranches, setAllBranches] = useState(!staff || (staff.branchIds ?? []).length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof StaffFormData>(key: K, value: StaffFormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggle = (key: "branchIds" | "shiftDays", value: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value],
    }));

  // A new role starts from that role's default checkboxes
  const changeRole = (role: StaffRole) =>
    setForm((f) => ({ ...f, role, permissions: defaultPermissions(role) }));

  const resetPermissions = () =>
    setForm((f) => ({ ...f, permissions: defaultPermissions(f.role) }));

  const togglePermission = (def: PermissionDef) =>
    setForm((f) => {
      const has = f.permissions.includes(def.key);

      if (has) {
        // Un-ticking a page also removes the actions that depend on it
        const dependents = ACTION_PERMISSIONS.filter((a) => a.requires === def.key).map(
          (a) => a.key
        );
        return {
          ...f,
          permissions: f.permissions.filter((k) => k !== def.key && !dependents.includes(k)),
        };
      }

      // Ticking an action also ticks the page it needs
      const next = [...f.permissions, def.key];
      if (def.requires && !next.includes(def.requires)) next.push(def.requires);
      return { ...f, permissions: next };
    });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!allBranches && form.branchIds.length === 0) {
      setError("Select at least one branch, or choose \"All branches\".");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        branchIds: allBranches ? [] : form.branchIds,
        specialization: form.role === "trainer" ? form.specialization.trim() : "",
        notes: form.notes.trim(),
        permissions: ALL_PERMISSIONS.map((p) => p.key).filter((k) =>
          form.permissions.includes(k)
        ),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
      setBusy(false);
    }
  };

  const roleInfo = ROLES.find((r) => r.value === form.role);
  const moduleLabel = (key?: string) => MODULE_PERMISSIONS.find((m) => m.key === key)?.label;
  const pagesPicked = MODULE_PERMISSIONS.filter((m) => form.permissions.includes(m.key)).length;

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
          {staff ? "Edit" : "New"} Team Member
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {staff ? "Update Staff Member" : "Add a Staff Member"}
        </h2>

        {/* Login */}
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-gold-soft">
          Profile & Login
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
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

          <div className={staff ? "sm:col-span-2" : ""}>
            <label className={label}>Login Email</label>
            <input
              type="email"
              className={`${field} ${staff ? "cursor-not-allowed opacity-60" : ""}`}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              disabled={!!staff}
              required
            />
          </div>

          {!staff && (
            <div>
              <label className={label}>Password</label>
              <input
                type="text"
                minLength={6}
                className={field}
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                required
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={label}>Role</label>
            <select
              className={field}
              value={form.role}
              onChange={(e) => changeRole(e.target.value as StaffRole)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {roleInfo && (
              <p className="mt-2 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold-soft">
                Default for this role: {roleInfo.help}
              </p>
            )}
          </div>

          {form.role === "trainer" && (
            <div className="sm:col-span-2">
              <label className={label}>Specialization</label>
              <input
                className={field}
                placeholder="e.g. Strength training, CrossFit, Yoga"
                value={form.specialization}
                onChange={(e) => set("specialization", e.target.value)}
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={label}>Works at</label>
            <label className="mb-3 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={allBranches}
                onChange={(e) => setAllBranches(e.target.checked)}
                className="h-4 w-4 accent-[#c9a227]"
              />
              <span className="text-sm">All branches</span>
            </label>
            {!allBranches && (
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => {
                  const on = form.branchIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggle("branchIds", b.id)}
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
        </div>

        {/* Access permissions */}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
              Access Permissions
            </p>
            <p className="mt-1 text-xs text-muted">
              Tick exactly what this person can open and do. Changing the role above resets these
              boxes to that role's defaults.
            </p>
          </div>
          <button
            type="button"
            onClick={resetPermissions}
            className="rounded-lg border border-line px-3.5 py-1.5 text-xs text-muted transition hover:border-gold/50 hover:text-charcoal"
          >
            Reset to {roleInfo?.label.split(" ")[0]} defaults
          </button>
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted">
          Pages they can open
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {MODULE_PERMISSIONS.map((def) => (
            <PermBox
              key={def.key}
              def={def}
              on={form.permissions.includes(def.key)}
              onToggle={() => togglePermission(def)}
            />
          ))}
        </div>
        {pagesPicked === 0 && (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            No pages selected. This person will only see the dashboard.
          </p>
        )}

        <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted">
          What they can do
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ACTION_PERMISSIONS.map((def) => (
            <PermBox
              key={def.key}
              def={def}
              on={form.permissions.includes(def.key)}
              needs={moduleLabel(def.requires)}
              onToggle={() => togglePermission(def)}
            />
          ))}
        </div>

        <p className="mt-3 text-xs text-muted">
          Staff, Membership Plans, Branches and Business Settings are always for the owner only.
        </p>

        {/* Shift */}
        <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-gold-soft">
          Weekly Shift
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Working Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = form.shiftDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggle("shiftDays", d)}
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
            <label className={label}>Shift Starts</label>
            <input
              type="time"
              className={field}
              value={form.shiftStart}
              onChange={(e) => set("shiftStart", e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Shift Ends</label>
            <input
              type="time"
              className={field}
              value={form.shiftEnd}
              onChange={(e) => set("shiftEnd", e.target.value)}
            />
          </div>
        </div>

        {/* Pay */}
        <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-gold-soft">
          Pay (visible to the owner only)
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Monthly Salary (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.salary}
              onChange={(e) => set("salary", Number(e.target.value))}
            />
          </div>
          <div>
            <label className={label}>Joining Date</label>
            <input
              type="date"
              className={field}
              value={form.joinDate}
              onChange={(e) => set("joinDate", e.target.value)}
            />
          </div>
          {form.role === "trainer" && (
            <>
              <div>
                <label className={label}>Personal Training Commission (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={field}
                  value={form.ptCommission}
                  onChange={(e) => set("ptCommission", Number(e.target.value))}
                />
              </div>
              <div>
                <label className={label}>Class Commission (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={field}
                  value={form.classCommission}
                  onChange={(e) => set("classCommission", Number(e.target.value))}
                />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className={label}>Private Notes</label>
            <textarea
              rows={2}
              className={`${field} resize-none`}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        {!staff && (
          <p className="mt-5 text-xs text-muted">
            The password is visible so you can share it. The staff member can change it later
            with "Forgot password" on the sign-in page.
          </p>
        )}

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
            {busy ? "Saving..." : staff ? "Update Staff" : "Create Staff Login"}
          </button>
        </div>
      </form>
    </div>
  );
}
