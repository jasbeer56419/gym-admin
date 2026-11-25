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
  writeBatch,
} from "firebase/firestore";
import {
  Clock,
  Dumbbell,
  KeyRound,
  Mail,
  MapPin,
  PauseCircle,
  Pencil,
  Phone,
  PlayCircle,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { auth, db, secondaryAuth } from "../../firebase";
import type { Member, StaffPrivate } from "../../types";
import { useOwner } from "../OwnerContext";
import { ROLE_LABEL, defaultPermissions, type StaffWithPermissions } from "../permissions";
import { memberStatus } from "../utils";
import StaffModal, { type StaffFormData } from "../components/StaffModal";
import AssignMembersModal from "../components/AssignMembersModal";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const roleStyle: Record<string, string> = {
  manager: "border-sky-500/30 bg-sky-500/10 text-sky-700",
  receptionist: "border-gold/40 bg-gold/15 text-gold-soft",
  trainer: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
};

const fmtT = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

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
      return "Could not create the login. Check your connection and try again.";
  }
};

// True when the owner changed the checkboxes away from the role defaults
const isCustom = (s: StaffWithPermissions) => {
  if (!s.permissions) return false;
  const base = defaultPermissions(s.role);
  return s.permissions.length !== base.length || s.permissions.some((k) => !base.includes(k));
};

export default function Staff() {
  const { businessId, business, plan, branches } = useOwner();

  const [staff, setStaff] = useState<StaffWithPermissions[]>([]);
  const [privates, setPrivates] = useState<Record<string, StaffPrivate>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ open: boolean; staff: StaffWithPermissions | null }>({
    open: false,
    staff: null,
  });
  const [assignTo, setAssignTo] = useState<StaffWithPermissions | null>(null);

  useEffect(() => {
    if (!businessId) return;

    const u1 = onSnapshot(
      collection(db, "businesses", businessId, "staff"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StaffWithPermissions);
        list.sort((a, b) => (a.createdAt?.seconds ?? 9e12) - (b.createdAt?.seconds ?? 9e12));
        setStaff(list);
        setLoading(false);
      },
      () => {
        setError("Could not load your team. Please try again.");
        setLoading(false);
      }
    );

    const u2 = onSnapshot(collection(db, "businesses", businessId, "staffPrivate"), (snap) => {
      const map: Record<string, StaffPrivate> = {};
      snap.docs.forEach((d) => (map[d.id] = d.data() as StaffPrivate));
      setPrivates(map);
    });

    const u3 = onSnapshot(collection(db, "businesses", businessId, "members"), (snap) =>
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member))
    );

    return () => {
      u1();
      u2();
      u3();
    };
  }, [businessId]);

  const activeBranches = branches.filter((b) => b.status === "active");

  // Plan limit (0 = unlimited). If the plan cannot be found, allow 5 to stay safe.
  const maxStaff = plan ? plan.maxStaff : 5;
  const atLimit = maxStaff !== 0 && staff.length >= maxStaff;

  const today = DAY_NAMES[new Date().getDay()];

  const stats = useMemo(() => {
    const live = staff.filter((s) => s.status === "active");
    return {
      total: staff.length,
      trainers: live.filter((s) => s.role === "trainer").length,
      frontDesk: live.filter((s) => s.role !== "trainer").length,
      onDuty: live.filter((s) => s.shift?.days?.includes(today)).length,
    };
  }, [staff, today]);

  const trainerStats = (id: string) => {
    const mine = members.filter((m) => m.trainerId === id && !m.archived);
    const active = mine.filter((m) => ["active", "expiring"].includes(memberStatus(m))).length;
    return { total: mine.length, active };
  };

  const handleSave = async (data: StaffFormData) => {
    if (!businessId || !business) return;

    const shift = { days: data.shiftDays, start: data.shiftStart, end: data.shiftEnd };
    const staffDoc = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      branchIds: data.branchIds,
      specialization: data.specialization,
      shift,
      permissions: data.permissions,
    };
    const privateDoc = {
      salary: data.salary,
      ptCommission: data.role === "trainer" ? data.ptCommission : 0,
      classCommission: data.role === "trainer" ? data.classCommission : 0,
      joinDate: data.joinDate,
      notes: data.notes,
    };

    // Edit
    if (modal.staff) {
      const id = modal.staff.id;
      const batch = writeBatch(db);
      batch.update(doc(db, "users", id), { name: data.name, role: data.role });
      batch.update(doc(db, "businesses", businessId, "staff", id), staffDoc);
      batch.set(doc(db, "businesses", businessId, "staffPrivate", id), privateDoc, {
        merge: true,
      });
      await batch.commit();
      return;
    }

    if (atLimit) {
      throw new Error("You have reached the staff limit of your plan.");
    }

    // New staff: first the login account (on the second app, so you stay signed in)
    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
      uid = cred.user.uid;
      await signOut(secondaryAuth);
    } catch (e) {
      throw new Error(
        e instanceof FirebaseError ? authError(e.code) : "Could not create the login."
      );
    }

    // Then the profile documents, all together
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, "users", uid), {
        name: data.name,
        email: data.email,
        role: data.role,
        businessId,
        businessName: business.name,
        status: "active",
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, "businesses", businessId, "staff", uid), {
        ...staffDoc,
        status: "active",
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, "businesses", businessId, "staffPrivate", uid), privateDoc);
      await batch.commit();
    } catch {
      throw new Error(
        "The login was created but the staff profile could not be saved. Check your Firestore rules, then delete that email in Firebase Console → Authentication and try again."
      );
    }
  };

  const toggleStatus = async (s: StaffWithPermissions) => {
    if (!businessId) return;
    const next = s.status === "active" ? "disabled" : "active";
    if (
      next === "disabled" &&
      !window.confirm(`Disable ${s.name}? They will be signed out of the portal immediately.`)
    ) {
      return;
    }
    const batch = writeBatch(db);
    batch.update(doc(db, "users", s.id), { status: next });
    batch.update(doc(db, "businesses", businessId, "staff", s.id), { status: next });
    await batch.commit();
  };

  const resetPassword = async (s: StaffWithPermissions) => {
    if (!window.confirm(`Send a password reset email to ${s.email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, s.email);
      window.alert(`Reset email sent to ${s.email}\n(Ask them to check their spam folder too)`);
    } catch {
      window.alert("Could not send the email. Please try again later.");
    }
  };

  const branchText = (s: StaffWithPermissions) => {
    const ids = s.branchIds ?? [];
    if (ids.length === 0) return "All branches";
    return (
      ids
        .map((id) => branches.find((b) => b.id === id)?.name)
        .filter(Boolean)
        .join(", ") || "Selected branches"
    );
  };

  const shiftText = (s: StaffWithPermissions) =>
    s.shift?.days?.length
      ? `${s.shift.days.join(", ")} · ${fmtT(s.shift.start)} – ${fmtT(s.shift.end)}`
      : "No shift set";

  const cards = [
    { label: "Team Members", value: stats.total, icon: Users },
    { label: "Trainers", value: stats.trainers, icon: Dumbbell },
    { label: "Managers & Front Desk", value: stats.frontDesk, icon: ShieldCheck },
    { label: "On Duty Today", value: stats.onDuty, icon: Clock },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">People</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Trainers & <span className="gold-text">Staff</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Give your team their own logins and choose exactly what each person can access.
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, staff: null })}
          disabled={atLimit}
          title={atLimit ? "Staff limit reached" : "Add a staff member"}
          className="btn-gold flex items-center gap-2 px-5 py-3 text-sm disabled:cursor-not-allowed"
        >
          <Plus size={18} /> Add Staff
        </button>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm">
          <b>{staff.length}</b> of <b>{maxStaff === 0 ? "unlimited" : maxStaff}</b> staff
          accounts used on your <b>{plan?.name ?? "current"}</b> plan.
        </p>
        {atLimit && (
          <p className="text-sm text-gold-soft">
            Limit reached. Contact the platform administrator to upgrade.
          </p>
        )}
      </div>

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
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-muted"}`}>{label}</p>
            </div>
          );
        })}
      </div>

      {loading ? (
        <div className="grid place-items-center p-20">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
        </div>
      ) : error ? (
        <p className="card p-10 text-center text-sm text-red-700">{error}</p>
      ) : staff.length === 0 ? (
        <div className="card grid place-items-center p-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
            <Users size={24} />
          </div>
          <p className="mt-4 font-display text-xl">No team members yet</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Click "Add Staff" to create a login for a manager, receptionist or trainer.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => {
            const ts = s.role === "trainer" ? trainerStats(s.id) : null;
            const onDuty = s.status === "active" && s.shift?.days?.includes(today);
            return (
              <div
                key={s.id}
                className={`card flex flex-col p-6 transition hover:-translate-y-1 hover:border-gold/40 ${
                  s.status === "disabled" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-display text-lg font-semibold text-charcoal">
                      {s.name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-semibold">{s.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] ${
                            roleStyle[s.role] ?? ""
                          }`}
                        >
                          {ROLE_LABEL[s.role] ?? s.role}
                        </span>
                        {isCustom(s) && (
                          <span className="inline-block rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] text-violet-700">
                            Custom access
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {s.status === "disabled" ? (
                    <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs text-red-700">
                      Disabled
                    </span>
                  ) : onDuty ? (
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700">
                      On duty today
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 space-y-2 text-sm text-muted">
                  <p className="flex items-center gap-2">
                    <Phone size={15} className="shrink-0" /> {s.phone}
                  </p>
                  <p className="flex items-center gap-2 break-all">
                    <Mail size={15} className="shrink-0" /> {s.email}
                  </p>
                  <p className="flex items-start gap-2">
                    <MapPin size={15} className="mt-0.5 shrink-0" /> {branchText(s)}
                  </p>
                  <p className="flex items-start gap-2">
                    <Clock size={15} className="mt-0.5 shrink-0" /> {shiftText(s)}
                  </p>
                </div>

                {s.specialization && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {s.specialization
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean)
                      .map((x) => (
                        <span
                          key={x}
                          className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 text-[11px] text-gold-soft"
                        >
                          {x}
                        </span>
                      ))}
                  </div>
                )}

                {ts && (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-black/[0.03] px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {ts.total} member{ts.total === 1 ? "" : "s"}
                      </p>
                      <p className="text-xs text-muted">{ts.active} with an active membership</p>
                    </div>
                    <button
                      onClick={() => setAssignTo(s)}
                      disabled={s.status === "disabled"}
                      className="rounded-lg bg-gold/15 px-3.5 py-1.5 text-xs font-medium text-gold-soft transition hover:bg-gold/25 disabled:opacity-50"
                    >
                      Assign members
                    </button>
                  </div>
                )}

                <div className="mt-auto flex justify-end gap-1 border-t border-line pt-4">
                  <button
                    title="Edit"
                    onClick={() => setModal({ open: true, staff: s })}
                    className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    title="Send password reset email"
                    onClick={() => resetPassword(s)}
                    className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    title={s.status === "active" ? "Disable" : "Enable"}
                    onClick={() => toggleStatus(s)}
                    className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                  >
                    {s.status === "active" ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal.open && (
        <StaffModal
          key={modal.staff?.id ?? "new"}
          staff={modal.staff}
          priv={modal.staff ? (privates[modal.staff.id] ?? null) : null}
          branches={activeBranches}
          onClose={() => setModal({ open: false, staff: null })}
          onSave={handleSave}
        />
      )}

      {assignTo && businessId && (
        <AssignMembersModal
          key={assignTo.id}
          businessId={businessId}
          trainer={assignTo}
          members={members}
          onClose={() => setAssignTo(null)}
        />
      )}
    </div>
  );
}
