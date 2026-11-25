import { useEffect, useState, type FormEvent } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { X } from "lucide-react";
import { db } from "../firebase";
import type { AppUser, Business, UserRole } from "../types";

export type UserFormData = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  businessId: string;
  businessName: string;
};

type Props = {
  user: AppUser | null; // null = new user, otherwise edit
  isSelf: boolean;
  onClose: () => void;
  onSave: (data: UserFormData) => Promise<void>;
};

const ROLES: { value: UserRole; label: string }[] = [
  { value: "owner", label: "Gym Owner" },
  { value: "manager", label: "Manager" },
  { value: "receptionist", label: "Receptionist" },
  { value: "trainer", label: "Trainer" },
  { value: "super_admin", label: "Super Admin" },
];

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function UserModal({ user, isSelf, onClose, onSave }: Props) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    role: (user?.role ?? "owner") as UserRole,
    businessId: user?.businessId ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "businesses"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Business);
      list.sort((a, b) => a.name.localeCompare(b.name));
      setBusinesses(list);
    });
    return unsub;
  }, []);

  const needsBusiness = form.role !== "super_admin";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (needsBusiness && !form.businessId) {
      setError("You must choose a business for this role.");
      return;
    }
    setBusy(true);
    try {
      const biz = businesses.find((b) => b.id === form.businessId);
      await onSave({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        businessId: needsBusiness ? form.businessId : "",
        businessName: needsBusiness ? (biz?.name ?? user?.businessName ?? "") : "",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
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
          {user ? "Edit" : "New"} User
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {user ? "Update User" : "Create a New User"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Full Name</label>
            <input
              className={field}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>

          <div className={user ? "sm:col-span-2" : ""}>
            <label className={label}>Email</label>
            <input
              type="email"
              className={`${field} ${user ? "cursor-not-allowed opacity-60" : ""}`}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={!!user}
              required
            />
          </div>

          {!user && (
            <div>
              <label className={label}>Password</label>
              <input
                type="text"
                minLength={6}
                className={field}
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
          )}

          <div>
            <label className={label}>Role</label>
            <select
              className={`${field} ${isSelf ? "cursor-not-allowed opacity-60" : ""}`}
              value={form.role}
              disabled={isSelf}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {needsBusiness && (
            <div>
              <label className={label}>Business</label>
              <select
                className={field}
                value={form.businessId}
                onChange={(e) => setForm((f) => ({ ...f, businessId: e.target.value }))}
              >
                <option value="">
                  {businesses.length === 0 ? "Add a business first" : "Choose a business..."}
                </option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isSelf && (
          <p className="mt-4 text-xs text-muted">
            This is your own account, so you cannot change your role (otherwise you would lock
            yourself out).
          </p>
        )}
        {!user && (
          <p className="mt-4 text-xs text-muted">
            The password is shown here so you can share it with the user. They can change it
            later with the "Reset Password" email.
          </p>
        )}

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
            {busy ? "Saving..." : user ? "Update" : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}
