import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserX,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import type { Member, StaffMember } from "../../types";
import { useOwner } from "../OwnerContext";
import { usePermissions } from "../permissions";
import { fmtT } from "../classUtils";
import { completeSession, setSessionStatus } from "../ptService";
import type {
  PtClient,
  PtPackage,
  PtPackageInput,
  PtSession,
  PtSessionStatus,
  PtStatus,
} from "../ptTypes";
import { addDays, fmtDate, rupee, todayStr } from "../utils";
import PtPackageModal from "../components/PtPackageModal";
import PtAssignModal from "../components/PtAssignModal";
import PtSessionModal from "../components/PtSessionModal";

type Tab = "sessions" | "clients" | "packages";
type ClientFilter = PtStatus | "all";

const STARTERS: PtPackageInput[] = [
  {
    name: "Trial Session",
    description: "One session to try personal training",
    sessions: 1,
    price: 500,
    validityDays: 7,
    status: "active",
  },
  {
    name: "10 Session Pack",
    description: "",
    sessions: 10,
    price: 8000,
    validityDays: 60,
    status: "active",
  },
  {
    name: "20 Session Pack",
    description: "",
    sessions: 20,
    price: 15000,
    validityDays: 120,
    status: "active",
  },
  {
    name: "30 Session Pack",
    description: "",
    sessions: 30,
    price: 21000,
    validityDays: 180,
    status: "active",
  },
];

const SESSION_STYLE: Record<PtSessionStatus, { label: string; cls: string }> = {
  scheduled: { label: "Scheduled", cls: "bg-sky-500/10 text-sky-700" },
  completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-slate-500/10 text-slate-600" },
  no_show: { label: "No-show", cls: "bg-red-500/10 text-red-700" },
};

const CLIENT_STYLE: Record<PtStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-700" },
  completed: { label: "Completed", cls: "bg-sky-500/10 text-sky-700" },
  expired: { label: "Expired", cls: "bg-red-500/10 text-red-700" },
  cancelled: { label: "Cancelled", cls: "bg-slate-500/10 text-slate-600" },
};

const FILTERS: { key: ClientFilter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "expired", label: "Expired" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export default function PersonalTraining() {
  const { businessId, branches, branchId } = useOwner();
  const { user, role } = useAuth();
   const { can } = usePermissions();
  const isTrainer = role === "trainer";
  const canManage = can("training.manage");
  

  const [packages, setPackages] = useState<PtPackage[]>([]);
  const [clients, setClients] = useState<PtClient[]>([]);
  const [sessions, setSessions] = useState<PtSession[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loaded, setLoaded] = useState({ packages: false, clients: false, sessions: false });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const today = todayStr();
  const [tab, setTab] = useState<Tab>("sessions");
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<ClientFilter>("active");
  const [search, setSearch] = useState("");
  const [seeding, setSeeding] = useState(false);

  const [pkgModal, setPkgModal] = useState<{ open: boolean; pkg: PtPackage | null }>({
    open: false,
    pkg: null,
  });
  const [assignOpen, setAssignOpen] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<PtClient | null>(null);

  const activeBranches = branches.filter((b) => b.status === "active");
  void activeBranches;

  useEffect(() => {
    if (!businessId) return;

    const fail = () => {
      setError("Could not load personal training data. Please try again.");
      setLoaded({ packages: true, clients: true, sessions: true });
    };

    const u1 = onSnapshot(
      collection(db, "businesses", businessId, "ptPackages"),
      (snap) => {
        setPackages(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PtPackage));
        setLoaded((l) => ({ ...l, packages: true }));
      },
      fail
    );
    const u2 = onSnapshot(
      collection(db, "businesses", businessId, "ptClients"),
      (snap) => {
        setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PtClient));
        setLoaded((l) => ({ ...l, clients: true }));
      },
      fail
    );
    // Only the last 60 days and everything after, to keep this light
    const u3 = onSnapshot(
      query(
        collection(db, "businesses", businessId, "ptSessions"),
        where("date", ">=", addDays(todayStr(), -60))
      ),
      (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PtSession));
        setLoaded((l) => ({ ...l, sessions: true }));
      },
      fail
    );

    const unsubs = [u1, u2, u3];

    // Trainers do not need the member and staff lists
    if (canManage) {
      unsubs.push(
        onSnapshot(collection(db, "businesses", businessId, "members"), (snap) =>
          setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member))
        ),
        onSnapshot(collection(db, "businesses", businessId, "staff"), (snap) =>
          setStaff(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StaffMember))
        )
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [businessId, canManage]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const trainers = staff.filter((s) => s.role === "trainer" && s.status === "active");

  // The real state: an active package past its end date counts as expired
  const stateOf = (c: PtClient): PtStatus =>
    c.status === "active" && c.expiryDate < today ? "expired" : c.status;

  const mine = <T extends { branchId: string; trainerId: string }>(x: T) =>
    (branchId === "all" || x.branchId === branchId) && (!isTrainer || x.trainerId === user?.uid);

  const scopedClients = useMemo(
    () => clients.filter(mine),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, branchId, isTrainer, user]
  );
  const scopedSessions = useMemo(
    () => sessions.filter(mine),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, branchId, isTrainer, user]
  );

  const scheduledOf = (c: PtClient) =>
    sessions.filter((s) => s.ptId === c.id && s.status === "scheduled").length;

  const stats = useMemo(() => {
    const month = today.slice(0, 7);
    return {
      active: scopedClients.filter((c) => stateOf(c) === "active").length,
      todayCount: scopedSessions.filter((s) => s.date === today && s.status !== "cancelled")
        .length,
      doneMonth: scopedSessions.filter(
        (s) => s.status === "completed" && s.date.startsWith(month)
      ).length,
      dues: scopedClients
        .filter((c) => c.status !== "cancelled")
        .reduce((sum, c) => sum + Math.max(0, c.price - c.paid), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedClients, scopedSessions, today]);

  const daySessions = useMemo(
    () =>
      scopedSessions
        .filter((s) => s.date === date)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [scopedSessions, date]
  );

  const clientRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedClients
      .filter(
        (c) =>
          (filter === "all" || stateOf(c) === filter) &&
          (!q ||
            c.memberName.toLowerCase().includes(q) ||
            c.memberCode.toLowerCase().includes(q) ||
            c.trainerName.toLowerCase().includes(q))
      )
      .sort((a, b) => (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedClients, filter, search, today]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ ok: true, text: await fn() });
    } catch (err) {
      setNotice({
        ok: false,
        text:
          err instanceof Error && err.message && !err.message.startsWith("Firebase")
            ? err.message
            : "Could not save. Please check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const complete = (s: PtSession) => {
    if (!businessId) return;
    const notes = window.prompt("Session notes (optional)", s.notes ?? "");
    if (notes === null) return;
    return run(async () => {
      await completeSession(businessId, s, notes.trim());
      return `Session with ${s.memberName} marked as completed.`;
    });
  };

  const markStatus = (s: PtSession, status: "cancelled" | "no_show") => {
    if (!businessId) return;
    const text =
      status === "cancelled"
        ? `Cancel the session with ${s.memberName}? It will not use up a session from the package.`
        : `Mark ${s.memberName} as a no-show? It will not use up a session from the package.`;
    if (!window.confirm(text)) return;
    return run(async () => {
      await setSessionStatus(businessId, s.id, status);
      return status === "cancelled" ? "Session cancelled." : "Marked as no-show.";
    });
  };

  const collectDue = (c: PtClient) => {
    if (!businessId) return;
    const due = Math.max(0, c.price - c.paid);
    if (due <= 0) return;
    const raw = window.prompt(`Amount received (balance due ${rupee(due)})`, String(due));
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0 || amount > due) {
      setNotice({ ok: false, text: `Enter an amount between ₹1 and ${rupee(due)}.` });
      return;
    }
    return run(async () => {
      await updateDoc(doc(db, "businesses", businessId, "ptClients", c.id), {
        paid: increment(amount),
      });
      return `${rupee(amount)} received from ${c.memberName}.`;
    });
  };

  const cancelPackage = (c: PtClient) => {
    if (!businessId) return;
    if (
      !window.confirm(
        `Cancel the ${c.packageName} package of ${c.memberName}? All upcoming scheduled sessions will be cancelled too.`
      )
    ) {
      return;
    }
    return run(async () => {
      const batch = writeBatch(db);
      batch.update(doc(db, "businesses", businessId, "ptClients", c.id), { status: "cancelled" });
      sessions
        .filter((s) => s.ptId === c.id && s.status === "scheduled")
        .forEach((s) =>
          batch.update(doc(db, "businesses", businessId, "ptSessions", s.id), {
            status: "cancelled",
          })
        );
      await batch.commit();
      return "Package cancelled.";
    });
  };

  const savePackage = async (data: PtPackageInput) => {
    if (!businessId) return;
    if (pkgModal.pkg) {
      await updateDoc(doc(db, "businesses", businessId, "ptPackages", pkgModal.pkg.id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, "businesses", businessId, "ptPackages"), {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
  };

  const togglePackage = async (p: PtPackage) => {
    if (!businessId) return;
    await updateDoc(doc(db, "businesses", businessId, "ptPackages", p.id), {
      status: p.status === "active" ? "inactive" : "active",
    });
  };

  const removePackage = async (p: PtPackage) => {
    if (!businessId) return;
    const inUse = clients.filter((c) => c.packageId === p.id).length;
    if (inUse > 0) {
      window.alert(
        `"${p.name}" has been sold to ${inUse} member(s). Deactivate it instead, so it can no longer be sold.`
      );
      return;
    }
    if (window.confirm(`Delete the "${p.name}" package? This cannot be undone.`)) {
      await deleteDoc(doc(db, "businesses", businessId, "ptPackages", p.id));
    }
  };

  const createStarters = async () => {
    if (!businessId) return;
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      STARTERS.forEach((p) => {
        batch.set(doc(collection(db, "businesses", businessId, "ptPackages")), {
          ...p,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } finally {
      setSeeding(false);
    }
  };

  const cards = [
    { label: "Active Clients", value: String(stats.active), sub: "With a running package", icon: Users },
    { label: "Sessions Today", value: String(stats.todayCount), sub: "Scheduled or done", icon: CalendarCheck },
    { label: "Completed This Month", value: String(stats.doneMonth), sub: "Sessions delivered", icon: CheckCircle2 },
    { label: "Pending Dues", value: rupee(stats.dues), sub: "On training packages", icon: Wallet },
  ];

  if (!loaded.packages || !loaded.clients || !loaded.sessions) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "sessions", label: "Sessions" },
    { key: "clients", label: `Clients (${scopedClients.length})` },
    ...(canManage ? [{ key: "packages" as Tab, label: `Packages (${packages.length})` }] : []),
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Gym Operations</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Personal <span className="gold-text">Training</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Sell training packages, schedule one-to-one sessions and track every session delivered.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setAssignOpen(true)}
            className="btn-gold flex items-center gap-2 px-5 py-3 text-sm"
          >
            <Plus size={18} /> Assign Package
          </button>
        )}
      </div>

      {error && <p className="card p-5 text-center text-sm text-red-700">{error}</p>}

      {notice && (
        <p
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.ok
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
              : "border-red-500/20 bg-red-500/10 text-red-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon }, i) => {
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
              <p className={`mt-6 font-display text-3xl font-semibold ${dark ? "text-gold-light" : ""}`}>
                {value}
              </p>
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-charcoal"}`}>{label}</p>
              <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>{sub}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg border px-4 py-2 text-sm transition ${
              tab === t.key
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-line text-muted hover:text-charcoal"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------------- Sessions ---------------- */}
      {tab === "sessions" && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
            <div>
              <h3 className="font-display text-xl">
                {date === today ? "Today's Sessions" : `Sessions on ${fmtDate(date)}`}
              </h3>
              <p className="text-sm text-muted">{daySessions.length} session(s)</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDate(addDays(date, -1))}
                className="rounded-lg border border-line p-2 text-muted transition hover:text-charcoal"
                title="Previous day"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="input-lux !w-auto !py-2 !pl-4 text-sm"
              />
              <button
                onClick={() => setDate(addDays(date, 1))}
                className="rounded-lg border border-line p-2 text-muted transition hover:text-charcoal"
                title="Next day"
              >
                <ChevronRight size={16} />
              </button>
              {date !== today && (
                <button
                  onClick={() => setDate(today)}
                  className="rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-charcoal"
                >
                  Today
                </button>
              )}
            </div>
          </div>

          {daySessions.length === 0 ? (
            <div className="grid place-items-center px-6 pb-12 pt-4 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <Dumbbell size={24} />
              </div>
              <p className="mt-4 font-display text-xl">No sessions on this day</p>
              <p className="mt-1 max-w-md text-sm text-muted">
                Go to the Clients tab and use "Schedule" on a client to book a session.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                    <th className="px-6 py-3 font-medium">Time</th>
                    <th className="px-6 py-3 font-medium">Member</th>
                    <th className="px-6 py-3 font-medium">Trainer</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {daySessions.map((s) => {
                    const st = SESSION_STYLE[s.status];
                    const open = s.status === "scheduled";
                    const canMark = open && s.date <= today;
                    return (
                      <tr key={s.id} className="border-b border-line/60 last:border-0">
                        <td className="whitespace-nowrap px-6 py-3 font-medium">
                          {fmtT(s.startTime)} to {fmtT(s.endTime)}
                        </td>
                        <td className="px-6 py-3">
                          <p className="font-medium">{s.memberName}</p>
                          {s.notes && <p className="text-xs text-muted">{s.notes}</p>}
                        </td>
                        <td className="px-6 py-3 text-muted">{s.trainerName}</td>
                        <td className="px-6 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs ${st.cls}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-1">
                            {canMark && (
                              <>
                                <button
                                  title="Mark completed"
                                  disabled={busy}
                                  onClick={() => complete(s)}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/20 disabled:opacity-50"
                                >
                                  <CheckCircle2 size={13} /> Complete
                                </button>
                                <button
                                  title="Mark no-show"
                                  disabled={busy}
                                  onClick={() => markStatus(s, "no_show")}
                                  className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                                >
                                  <UserX size={16} />
                                </button>
                              </>
                            )}
                            {open && (
                              <button
                                title="Cancel session"
                                disabled={busy}
                                onClick={() => markStatus(s, "cancelled")}
                                className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                              >
                                <XCircle size={16} />
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
      )}

      {/* ---------------- Clients ---------------- */}
      {tab === "clients" && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                placeholder="Search by member, code or trainer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-lux !py-2.5 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg border px-3.5 py-2 text-sm transition ${
                    filter === f.key
                      ? "border-gold/50 bg-gold/15 text-gold-soft"
                      : "border-line text-muted hover:text-charcoal"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {clientRows.length === 0 ? (
            <div className="grid place-items-center p-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <Users size={24} />
              </div>
              <p className="mt-4 font-display text-xl">
                {clients.length === 0 ? "No training clients yet" : "No clients found"}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted">
                {clients.length === 0
                  ? canManage
                    ? 'Click "Assign Package" to sell a training package to a member.'
                    : "The gym owner will assign members to you."
                  : "Try a different search or filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                    <th className="px-6 py-4 font-medium">Member</th>
                    <th className="px-6 py-4 font-medium">Package</th>
                    <th className="px-6 py-4 font-medium">Trainer</th>
                    <th className="px-6 py-4 font-medium">Sessions</th>
                    <th className="px-6 py-4 font-medium">Valid until</th>
                    <th className="px-6 py-4 font-medium">Payment</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clientRows.map((c) => {
                    const st = stateOf(c);
                    const due = Math.max(0, c.price - c.paid);
                    const scheduled = scheduledOf(c);
                    const left = c.totalSessions - c.usedSessions - scheduled;
                    const pct = Math.min(100, (c.usedSessions / c.totalSessions) * 100);
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-line/60 transition last:border-0 hover:bg-gold/5"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium">{c.memberName}</p>
                          <p className="text-xs text-muted">{c.memberCode}</p>
                        </td>
                        <td className="px-6 py-4 text-muted">{c.packageName}</td>
                        <td className="px-6 py-4 text-muted">{c.trainerName}</td>
                        <td className="min-w-[150px] px-6 py-4">
                          <p>
                            <b>{c.usedSessions}</b> / {c.totalSessions} done
                          </p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gold/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {scheduled > 0 && (
                            <p className="mt-1 text-xs text-muted">{scheduled} scheduled</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-muted">{fmtDate(c.expiryDate)}</td>
                        <td className="px-6 py-4">
                          <p>
                            {rupee(c.paid)} <span className="text-muted">/ {rupee(c.price)}</span>
                          </p>
                          {due > 0 && c.status !== "cancelled" && (
                            <p className="text-xs text-red-600">{rupee(due)} due</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs ${CLIENT_STYLE[st].cls}`}>
                            {CLIENT_STYLE[st].label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {st === "active" && (
                              <button
                                onClick={() => setScheduleFor(c)}
                                disabled={left <= 0}
                                title={left <= 0 ? "No sessions left to schedule" : "Schedule a session"}
                                className="rounded-lg bg-gold/15 px-3 py-1.5 text-xs font-medium text-gold-soft transition hover:bg-gold/25 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Schedule
                              </button>
                            )}
                            {canManage && due > 0 && c.status !== "cancelled" && (
                              <button
                                onClick={() => collectDue(c)}
                                disabled={busy}
                                className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/20 disabled:opacity-50"
                              >
                                Collect
                              </button>
                            )}
                            {canManage && st === "active" && (
                              <button
                                title="Cancel package"
                                onClick={() => cancelPackage(c)}
                                disabled={busy}
                                className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
                              >
                                <XCircle size={16} />
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
      )}

      {/* ---------------- Packages ---------------- */}
      {tab === "packages" && canManage && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setPkgModal({ open: true, pkg: null })}
              className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <Plus size={16} /> Add Package
            </button>
          </div>

          {packages.length === 0 ? (
            <div className="card grid place-items-center p-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <Dumbbell size={24} />
              </div>
              <p className="mt-4 font-display text-xl">No training packages yet</p>
              <p className="mt-1 max-w-md text-sm text-muted">
                Create 4 starter packages in one click (Trial, 10, 20 and 30 sessions). The prices
                are examples, so edit them to match your gym. Or build your own with "Add Package".
              </p>
              <button
                onClick={createStarters}
                disabled={seeding}
                className="btn-gold mt-6 flex items-center gap-2 px-6 py-3 text-sm"
              >
                <Sparkles size={17} /> {seeding ? "Creating..." : "Create Starter Packages"}
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {packages
                .slice()
                .sort((a, b) => a.sessions - b.sessions)
                .map((p) => {
                  const sold = clients.filter((c) => c.packageId === p.id).length;
                  return (
                    <div
                      key={p.id}
                      className={`card flex flex-col p-7 transition hover:-translate-y-1 hover:border-gold/40 ${
                        p.status === "inactive" ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-2xl font-semibold">{p.name}</h3>
                        {p.status === "inactive" && (
                          <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] text-slate-600">
                            Inactive
                          </span>
                        )}
                      </div>

                      <p className="mt-5 font-display text-4xl font-semibold">{rupee(p.price)}</p>
                      <p className="text-xs text-muted">
                        {p.sessions} session{p.sessions === 1 ? "" : "s"} · about{" "}
                        {rupee(Math.round(p.price / p.sessions))} each
                      </p>

                      {p.description && <p className="mt-3 text-sm text-muted">{p.description}</p>}

                      <p className="mt-4 text-sm text-muted">Valid for {p.validityDays} days</p>

                      <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
                        <span className="flex items-center gap-1.5 text-sm text-muted">
                          <Users size={15} /> {sold} sold
                        </span>
                        <div className="flex gap-1">
                          <button
                            title="Edit"
                            onClick={() => setPkgModal({ open: true, pkg: p })}
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            title={p.status === "active" ? "Deactivate" : "Activate"}
                            onClick={() => togglePackage(p)}
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            {p.status === "active" ? (
                              <PauseCircle size={16} />
                            ) : (
                              <PlayCircle size={16} />
                            )}
                          </button>
                          <button
                            title="Delete"
                            onClick={() => removePackage(p)}
                            className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {pkgModal.open && (
        <PtPackageModal
          key={pkgModal.pkg?.id ?? "new"}
          pkg={pkgModal.pkg}
          onClose={() => setPkgModal({ open: false, pkg: null })}
          onSave={savePackage}
        />
      )}

      {assignOpen && businessId && (
        <PtAssignModal
          businessId={businessId}
          members={members}
          trainers={trainers}
          packages={packages.filter((p) => p.status === "active")}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {scheduleFor && businessId && (
        <PtSessionModal
          key={scheduleFor.id}
          businessId={businessId}
          client={scheduleFor}
          sessions={sessions}
          onClose={() => setScheduleFor(null)}
        />
      )}
    </div>
  );
}