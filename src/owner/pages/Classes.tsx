import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  Hourglass,
  MapPin,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import type {
  ClassSession,
  GymClass,
  GymClassInput,
  Member,
  MembershipPlan,
  StaffMember,
} from "../../types";
import { useOwner } from "../OwnerContext";
import { usePermissions } from "../permissions";
import { DAYS, dayName, fmtT, mondayOf, sessionId } from "../classUtils";
import { addDays, fmtDate, parseDate, todayStr } from "../utils";
import ClassModal from "../components/ClassModal";
import ClassRosterModal from "../components/ClassRosterModal";

type Tab = "schedule" | "manage";

export default function Classes() {
  const { businessId, branches, branchId } = useOwner();
  const { user, role } = useAuth();
  const { can } = usePermissions();
  const canManage = can("classes.manage");
  const canBook = can("classes.book");
  const canAttend = can("classes.attend");

  const [classes, setClasses] = useState<GymClass[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = todayStr();
  const [tab, setTab] = useState<Tab>("schedule");
  const [date, setDate] = useState(today);
  const [mineOnly, setMineOnly] = useState(role === "trainer");

  const [modal, setModal] = useState<{ open: boolean; cls: GymClass | null }>({
    open: false,
    cls: null,
  });
  const [roster, setRoster] = useState<{ cls: GymClass; date: string } | null>(null);

  const weekStart = mondayOf(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];

  useEffect(() => {
    if (!businessId) return;

    const u1 = onSnapshot(
      collection(db, "businesses", businessId, "classes"),
      (snap) => {
        setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GymClass));
        setLoading(false);
      },
      () => {
        setError("Could not load classes. Please try again.");
        setLoading(false);
      }
    );
    const u2 = onSnapshot(collection(db, "businesses", businessId, "members"), (snap) =>
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member))
    );
    const u3 = onSnapshot(collection(db, "businesses", businessId, "membershipPlans"), (snap) =>
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MembershipPlan))
    );
    const u4 = onSnapshot(collection(db, "businesses", businessId, "staff"), (snap) =>
      setStaff(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StaffMember))
    );
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [businessId]);

  // Booking sheets for the week on screen
  useEffect(() => {
    if (!businessId) return;
    return onSnapshot(
      query(
        collection(db, "businesses", businessId, "classSessions"),
        where("date", ">=", weekStart),
        where("date", "<=", weekEnd)
      ),
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ClassSession)),
      () => setError("Could not load bookings. Please try again.")
    );
  }, [businessId, weekStart, weekEnd]);

  const activeBranches = branches.filter((b) => b.status === "active");
  const trainers = staff.filter((s) => s.role === "trainer" && s.status === "active");

  const scoped = useMemo(
    () =>
      classes.filter(
        (c) =>
          (branchId === "all" || c.branchId === branchId) &&
          (!mineOnly || c.trainerId === user?.uid)
      ),
    [classes, branchId, mineOnly, user]
  );

  const classesOn = (d: string) =>
    scoped
      .filter((c) => c.status === "active" && c.days.includes(dayName(d)))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dayClasses = classesOn(date);
  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const sessionOf = (c: GymClass, d: string) => sessionMap.get(sessionId(c.id, d)) ?? null;

  const stats = useMemo(() => {
    const running = dayClasses.filter((c) => !sessionOf(c, date)?.cancelled);
    const booked = running.reduce((s, c) => s + (sessionOf(c, date)?.roster.length ?? 0), 0);
    const seats = running.reduce((s, c) => s + c.capacity, 0);
    const waiting = running.reduce((s, c) => s + (sessionOf(c, date)?.waitlist.length ?? 0), 0);
    return {
      classes: running.length,
      booked,
      fill: seats === 0 ? 0 : Math.round((booked / seats) * 100),
      waiting,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayClasses, sessionMap, date]);

  const handleSave = async (data: GymClassInput) => {
    if (!businessId) return;
    const payload = {
      ...data,
      branchName: branches.find((b) => b.id === data.branchId)?.name ?? "",
      trainerName: staff.find((s) => s.id === data.trainerId)?.name ?? "",
    };
    if (modal.cls) {
      await updateDoc(doc(db, "businesses", businessId, "classes", modal.cls.id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, "businesses", businessId, "classes"), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  };

  const toggleStatus = async (c: GymClass) => {
    if (!businessId) return;
    await updateDoc(doc(db, "businesses", businessId, "classes", c.id), {
      status: c.status === "active" ? "inactive" : "active",
    });
  };

  const remove = async (c: GymClass) => {
    if (!businessId) return;
    if (
      window.confirm(
        `Delete the "${c.name}" class? Past booking records stay in the database. If you only want to hide it, deactivate it instead.`
      )
    ) {
      await deleteDoc(doc(db, "businesses", businessId, "classes", c.id));
    }
  };

  const dayLabel = date === today ? "Today" : fmtDate(date);

  const cards = [
    { label: `Classes ${date === today ? "Today" : "on this day"}`, value: String(stats.classes), sub: dayLabel, icon: CalendarDays },
    { label: "Members Booked", value: String(stats.booked), sub: "Seats taken", icon: Users },
    { label: "Seats Filled", value: `${stats.fill}%`, sub: "Booked out of capacity", icon: Gauge },
    { label: "On Waitlist", value: String(stats.waiting), sub: "Waiting for a seat", icon: Hourglass },
  ];

  if (loading) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Gym Operations</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Classes & <span className="gold-text">Activities</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Plan your weekly schedule, book members and track who attends.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setModal({ open: true, cls: null })}
            disabled={activeBranches.length === 0}
            title={activeBranches.length === 0 ? "Add a branch first" : "Create a class"}
            className="btn-gold flex items-center gap-2 px-5 py-3 text-sm disabled:cursor-not-allowed"
          >
            <Plus size={18} /> Add Class
          </button>
        )}
      </div>

      {error && <p className="card p-5 text-center text-sm text-red-700">{error}</p>}

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
              <p
                className={`mt-6 font-display text-3xl font-semibold ${
                  dark ? "text-gold-light" : ""
                }`}
              >
                {value}
              </p>
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-charcoal"}`}>{label}</p>
              <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>{sub}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "schedule", label: "Schedule & Bookings" },
            { key: "manage", label: `Manage Classes (${scoped.length})` },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
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
        {role === "trainer" && (
          <button
            onClick={() => setMineOnly(!mineOnly)}
            className={`ml-auto rounded-lg border px-4 py-2 text-sm transition ${
              mineOnly
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-line text-muted hover:text-charcoal"
            }`}
          >
            Only my classes
          </button>
        )}
      </div>

      {/* ---------------- Schedule ---------------- */}
      {tab === "schedule" && (
        <>
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDate(addDays(date, -7))}
                  className="rounded-lg border border-line p-2 text-muted transition hover:text-charcoal"
                  title="Previous week"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setDate(addDays(date, 7))}
                  className="rounded-lg border border-line p-2 text-muted transition hover:text-charcoal"
                  title="Next week"
                >
                  <ChevronRight size={16} />
                </button>
                <p className="ml-2 text-sm text-muted">
                  {fmtDate(weekStart)} to {fmtDate(weekEnd)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="input-lux !w-auto !py-2 !pl-4 text-sm"
                />
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

            <div className="mt-4 grid grid-cols-7 gap-2">
              {weekDays.map((d, i) => {
                const n = classesOn(d).length;
                const on = d === date;
                return (
                  <button
                    key={d}
                    onClick={() => setDate(d)}
                    className={`rounded-xl border px-2 py-3 text-center transition ${
                      on
                        ? "border-gold/60 bg-gold/15"
                        : "border-line bg-white/60 hover:border-gold/40"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-wider text-muted">{DAYS[i]}</p>
                    <p
                      className={`mt-1 font-display text-xl font-semibold ${
                        d === today ? "text-gold-soft" : ""
                      }`}
                    >
                      {parseDate(d).getDate()}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {n === 0 ? "No classes" : `${n} class${n === 1 ? "" : "es"}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {dayClasses.length === 0 ? (
            <div className="card grid place-items-center p-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <CalendarDays size={24} />
              </div>
              <p className="mt-4 font-display text-xl">
                {classes.length === 0 ? "No classes yet" : "No classes on this day"}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted">
                {classes.length === 0
                  ? canManage
                    ? "Click \"Add Class\" to create your first weekly class."
                    : "The gym owner has not created any classes yet."
                  : "Pick another day, or check the branch switcher at the top."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {dayClasses.map((c) => {
                const s = sessionOf(c, date);
                const booked = s?.roster.length ?? 0;
                const waiting = s?.waitlist.length ?? 0;
                const cancelled = !!s?.cancelled;
                const pct = Math.min(100, (booked / c.capacity) * 100);
                const full = booked >= c.capacity;
                return (
                  <div
                    key={c.id}
                    className={`card flex flex-col p-6 transition hover:-translate-y-1 hover:border-gold/40 ${
                      cancelled ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-xl font-semibold">{c.name}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                          <Clock size={14} /> {fmtT(c.startTime)} to {fmtT(c.endTime)}
                        </p>
                      </div>
                      {cancelled ? (
                        <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs text-red-700">
                          Cancelled
                        </span>
                      ) : full ? (
                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700">
                          Full
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-1.5 text-sm text-muted">
                      <p className="flex items-center gap-2">
                        <User size={14} className="shrink-0" />
                        {c.trainerName || "No trainer assigned"}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin size={14} className="shrink-0" /> {c.branchName}
                      </p>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-baseline justify-between text-sm">
                        <span>
                          <b>{booked}</b> / {c.capacity} booked
                        </span>
                        {waiting > 0 && (
                          <span className="text-xs text-amber-700">{waiting} waiting</span>
                        )}
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gold/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setRoster({ cls: c, date })}
                      className="btn-gold mt-5 px-5 py-2.5 text-sm"
                    >
                      {date < today
                        ? "View roster"
                        : canBook
                          ? "Roster & Bookings"
                          : "View roster"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---------------- Manage ---------------- */}
      {tab === "manage" &&
        (scoped.length === 0 ? (
          <div className="card grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
              <CalendarDays size={24} />
            </div>
            <p className="mt-4 font-display text-xl">No classes found</p>
            <p className="mt-1 text-sm text-muted">
              {canManage ? "Click \"Add Class\" to create one." : "Nothing to show yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {scoped.map((c) => (
              <div
                key={c.id}
                className={`card flex flex-col p-6 transition hover:-translate-y-1 hover:border-gold/40 ${
                  c.status === "inactive" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-semibold">{c.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {fmtT(c.startTime)} to {fmtT(c.endTime)}
                    </p>
                  </div>
                  {c.status === "inactive" && (
                    <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-xs text-slate-600">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {DAYS.filter((d) => c.days.includes(d)).map((d) => (
                    <span
                      key={d}
                      className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 text-[11px] text-gold-soft"
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {c.description && <p className="mt-3 text-sm text-muted">{c.description}</p>}

                <div className="mt-4 space-y-1.5 text-sm text-muted">
                  <p className="flex items-center gap-2">
                    <User size={14} className="shrink-0" />
                    {c.trainerName || "No trainer assigned"}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="shrink-0" /> {c.branchName}
                  </p>
                  <p className="flex items-center gap-2">
                    <Users size={14} className="shrink-0" /> {c.capacity} seats
                  </p>
                </div>

                {canManage && (
                  <div className="mt-auto flex justify-end gap-1 border-t border-line pt-4">
                    <button
                      title="Edit"
                      onClick={() => setModal({ open: true, cls: c })}
                      className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      title={c.status === "active" ? "Deactivate" : "Activate"}
                      onClick={() => toggleStatus(c)}
                      className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                    >
                      {c.status === "active" ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                    </button>
                    <button
                      title="Delete"
                      onClick={() => remove(c)}
                      className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

      {modal.open && (
        <ClassModal
          key={modal.cls?.id ?? "new"}
          cls={modal.cls}
          branches={activeBranches}
          trainers={trainers}
          defaultBranchId={
            branchId !== "all" && activeBranches.some((b) => b.id === branchId)
              ? branchId
              : (activeBranches[0]?.id ?? "")
          }
          onClose={() => setModal({ open: false, cls: null })}
          onSave={handleSave}
        />
      )}

      {roster && businessId && (
        <ClassRosterModal
          key={sessionId(roster.cls.id, roster.date)}
          businessId={businessId}
          cls={roster.cls}
          date={roster.date}
          session={sessionOf(roster.cls, roster.date)}
          members={members}
          plans={plans}
          canBook={canBook}
          canAttend={canAttend}
          canManage={canManage}
          onClose={() => setRoster(null)}
        />
      )}
    </div>
  );
}