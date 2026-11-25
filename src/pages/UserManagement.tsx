import { useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  Briefcase,
  KeyRound,
  Pencil,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  ShieldCheck,
  UserX,
  Users,
} from "lucide-react";
import { auth, db, secondaryAuth } from "../firebase";
import { useAuth } from "../AuthContext";
import { logAction } from "../audit";
import type { AppUser, UserRole } from "../types";
import UserModal, { type UserFormData } from "../components/UserModal";

type Filter = "all" | UserRole;

const roleLabel: Record<UserRole, string> = {
  super_admin: "Super Admin",
  owner: "Gym Owner",
  manager: "Manager",
  receptionist: "Receptionist",
  trainer: "Trainer",
};

const roleStyle: Record<UserRole, string> = {
  super_admin: "border-charcoal/30 bg-charcoal text-gold-light",
  owner: "border-gold/40 bg-gold/15 text-gold-soft",
  manager: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  receptionist: "border-gold/40 bg-gold/15 text-gold-soft",
  trainer: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
};

const FILTERS: Filter[] = ["all", "super_admin", "owner", "manager", "receptionist", "trainer"];

const authError = (code: string) => {
  switch (code) {
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is not enabled in Firebase.";
    default:
      return "Could not create the user. Check your internet connection or Firebase setup.";
  }
};

export default function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{ open: boolean; user: AppUser | null }>({
    open: false,
    user: null,
  });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "users"),
      (snap) => {
        const list = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            ...x,
            // Safe default for any field that is missing from the document
            name: x.name ?? "",
            email:
              x.email ??
              (d.id === auth.currentUser?.uid ? (auth.currentUser?.email ?? "") : ""),
            businessId: x.businessId ?? null,
            businessName: x.businessName ?? "",
            status: x.status ?? "active",
          } as AppUser;
        });

        list.sort(
          (a, b) => (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
        );
        setUsers(list);
        setLoading(false);
      },
      () => {
        setLoadError("Could not load users. Please check your Firestore rules.");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const stats = useMemo(
    () => ({
      total: users.length,
      owners: users.filter((u) => u.role === "owner").length,
      staff: users.filter((u) => ["manager", "receptionist", "trainer"].includes(u.role))
        .length,
      disabled: users.filter((u) => u.status === "disabled").length,
    }),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const okRole = filter === "all" || u.role === filter;
      const okSearch =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      return okRole && okSearch;
    });
  }, [users, search, filter]);

  const handleSave = async (data: UserFormData) => {
    const businessId = data.role === "super_admin" ? null : data.businessId;
    const businessName = data.role === "super_admin" ? "" : data.businessName;

    // Edit
    if (modal.user) {
      await updateDoc(doc(db, "users", modal.user.id), {
        name: data.name,
        role: data.role,
        businessId,
        businessName,
      });
      await logAction("Users", "Updated", `${data.name} (${modal.user.email})`);
      return;
    }

    // New user: first the login account (on the second app), then the profile
    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email,
        data.password
      );
      uid = cred.user.uid;
      await signOut(secondaryAuth);
    } catch (e) {
      throw new Error(
        e instanceof FirebaseError ? authError(e.code) : "Could not create the user."
      );
    }

    try {
      await setDoc(doc(db, "users", uid), {
        name: data.name,
        email: data.email,
        role: data.role,
        businessId,
        businessName,
        status: "active",
        createdAt: serverTimestamp(),
      });
      await logAction("Users", "Created", `${data.name} (${data.email}) as ${data.role}`);
    } catch {
      throw new Error(
        "The login account was created but the profile could not be saved. Check your " +
          "Firestore rules, then delete that email in Firebase Console, Authentication, " +
          "and try again."
      );
    }
  };

  const toggleStatus = async (u: AppUser) => {
    const next = u.status === "active" ? "disabled" : "active";
    if (
      next === "disabled" &&
      !window.confirm(`Disable ${u.name}? They will not be able to log in to the panel.`)
    ) {
      return;
    }
    await updateDoc(doc(db, "users", u.id), { status: next });
    await logAction(
      "Users",
      next === "disabled" ? "Disabled" : "Enabled",
      `${u.name} (${u.email})`
    );
  };

  const resetPassword = async (u: AppUser) => {
    if (!window.confirm(`Send a password reset email to ${u.email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, u.email);
      await logAction("Users", "Password reset sent", `${u.name} (${u.email})`);
      window.alert(`Reset email sent to ${u.email}\n(Ask them to check their spam folder too)`);
    } catch {
      window.alert("Could not send the email. Please try again later.");
    }
  };

  const fmtDate = (u: AppUser) =>
    u.createdAt
      ? u.createdAt.toDate().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  const cards = [
    { label: "Total Users", value: stats.total, icon: Users },
    { label: "Gym Owners", value: stats.owners, icon: Briefcase },
    { label: "Staff (Manager, Reception, Trainer)", value: stats.staff, icon: ShieldCheck },
    { label: "Disabled", value: stats.disabled, icon: UserX },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Access Control</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            User <span className="gold-text">Management</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            All platform logins and their roles are controlled from here.
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, user: null })}
          className="btn-gold flex items-center gap-2 px-5 py-3 text-sm"
        >
          <Plus size={18} /> Add User
        </button>
      </div>

      {/* Cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }, i) => {
          const dark = i === 0;
          return (
            <div
              key={label}
              className={`rounded-2xl p-6 transition hover:-translate-y-1 ${
                dark
                  ? "border border-gold/40 bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] text-white shadow-xl shadow-black/25"
                  : "card hover:border-gold/40"
              }`}
            >
              <div
                className={`grid h-11 w-11 place-items-center rounded-xl border ${
                  dark
                    ? "border-gold/30 bg-gold/15 text-gold-light"
                    : "border-gold/25 bg-gold/10 text-gold-soft"
                }`}
              >
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <p
                className={`mt-6 font-display text-3xl font-semibold ${
                  dark ? "text-gold-light" : ""
                }`}
              >
                {value}
              </p>
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-muted"}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-lux !py-2.5 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg border px-4 py-2 text-sm transition ${
                  filter === f
                    ? "border-gold/50 bg-gold/15 text-gold-soft"
                    : "border-line text-muted hover:text-charcoal"
                }`}
              >
                {f === "all" ? "All" : roleLabel[f]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center p-16">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
          </div>
        ) : loadError ? (
          <p className="p-10 text-center text-sm text-red-700">{loadError}</p>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
              <Users size={24} />
            </div>
            <p className="mt-4 font-display text-xl">No users found</p>
            <p className="mt-1 text-sm text-muted">Try changing the search or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Business</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Joined</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === me?.uid;
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-line/60 transition last:border-0 hover:bg-gold/5"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal">
                            {(u.name || u.email || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">
                              {u.name || "—"}
                              {isSelf && (
                                <span className="ml-2 rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold-soft">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            roleStyle[u.role] ?? "border-line text-muted"
                          }`}
                        >
                          {roleLabel[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted">{u.businessName || "—"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs capitalize ${
                            u.status === "disabled"
                              ? "bg-red-500/10 text-red-700"
                              : "bg-emerald-500/10 text-emerald-700"
                          }`}
                        >
                          {u.status ?? "active"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted">{fmtDate(u)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            title="Edit"
                            onClick={() => setModal({ open: true, user: u })}
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            title="Send password reset email"
                            onClick={() => resetPassword(u)}
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            <KeyRound size={16} />
                          </button>
                          {!isSelf && (
                            <button
                              title={u.status === "disabled" ? "Enable" : "Disable"}
                              onClick={() => toggleStatus(u)}
                              className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                            >
                              {u.status === "disabled" ? (
                                <PlayCircle size={16} />
                              ) : (
                                <PauseCircle size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <UserModal
          key={modal.user?.id ?? "new"}
          user={modal.user}
          isSelf={modal.user?.id === me?.uid}
          onClose={() => setModal({ open: false, user: null })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
