import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  collection,
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
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Camera,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  ScanLine,
  Search,
  ShieldAlert,
  UserX,
  Users,
} from "lucide-react";
import { db } from "../../firebase";
import type { AttendanceRecord, Member, MembershipPlan } from "../../types";
import { useOwner } from "../OwnerContext";
import {
  daysBetween,
  expiryText,
  fmtDate,
  fmtDuration,
  fmtTime,
  memberStatus,
  minutesSince,
  statusMeta,
  todayStr,
} from "../utils";
import QrScannerModal, { type ScanResult } from "../components/QrScannerModal";

type Notice = {
  kind: "success" | "warning" | "error" | "info";
  title: string;
  text: string;
};

const noticeStyle: Record<Notice["kind"], string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-800",
  error: "border-red-500/30 bg-red-500/10 text-red-800",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-800",
};

const hourLabel = (h: number) => `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`;

export default function Attendance() {
  const { businessId, branches, branchId } = useOwner();
  const activeBranches = branches.filter((b) => b.status === "active");

  const [date, setDate] = useState(todayStr());
  const isToday = date === todayStr();

  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [sessions, setSessions] = useState<AttendanceRecord[]>([]);
  const [loaded, setLoaded] = useState({ members: false, sessions: false });
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [deskBranch, setDeskBranch] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<Member | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [, setTick] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Refresh "inside for N min" every minute
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!businessId) return;
    const u1 = onSnapshot(
      collection(db, "businesses", businessId, "members"),
      (snap) => {
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member));
        setLoaded((l) => ({ ...l, members: true }));
      },
      () => {
        setError("Could not load members. Please try again.");
        setLoaded((l) => ({ ...l, members: true }));
      }
    );
    const u2 = onSnapshot(
      collection(db, "businesses", businessId, "membershipPlans"),
      (snap) => setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MembershipPlan))
    );
    return () => {
      u1();
      u2();
    };
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    return onSnapshot(
      query(collection(db, "businesses", businessId, "attendance"), where("date", "==", date)),
      (snap) => {
        setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord));
        setLoaded((l) => ({ ...l, sessions: true }));
      },
      () => {
        setError("Could not load attendance. Please try again.");
        setLoaded((l) => ({ ...l, sessions: true }));
      }
    );
  }, [businessId, date]);

  // Which branch is the desk checking people in to
  const checkBranchId =
    branchId !== "all" ? branchId : deskBranch || (activeBranches[0]?.id ?? "");
  const checkBranch = activeBranches.find((b) => b.id === checkBranchId);

  const candidates = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return members
      .filter(
        (m) =>
          !m.archived &&
          (m.name.toLowerCase().includes(term) ||
            m.phone.includes(term) ||
            m.code.toLowerCase().includes(term))
      )
      .slice(0, 6);
  }, [members, q]);

  const scopedSessions = useMemo(
    () =>
      sessions
        .filter((s) => branchId === "all" || s.branchId === branchId)
        .sort((a, b) => (b.checkInAt?.seconds ?? 9e12) - (a.checkInAt?.seconds ?? 9e12)),
    [sessions, branchId]
  );

  const inside = scopedSessions.filter((s) => !s.checkOutAt);

  const stats = useMemo(() => {
    const closed = scopedSessions.filter((s) => s.checkInAt && s.checkOutAt);
    const avg =
      closed.length === 0
        ? null
        : Math.round(
            closed.reduce(
              (sum, s) => sum + (s.checkOutAt!.seconds - s.checkInAt!.seconds) / 60,
              0
            ) / closed.length
          );
    return {
      visits: scopedSessions.length,
      unique: new Set(scopedSessions.map((s) => s.memberId)).size,
      avg,
    };
  }, [scopedSessions]);

  // Check-ins by hour (5 am to 11 pm)
  const hourly = useMemo(() => {
    const counts = Array<number>(24).fill(0);
    scopedSessions.forEach((s) => {
      const h = s.checkInAt?.toDate().getHours();
      if (h !== undefined) counts[h]++;
    });
    return Array.from({ length: 19 }, (_, i) => ({ h: hourLabel(i + 5), hour: i + 5, v: counts[i + 5] }));
  }, [scopedSessions]);

  const peak = hourly.reduce((best, x) => (x.v > best.v ? x : best), hourly[0]);

  // Active members who have not visited for 14+ days
  const inactive = useMemo(() => {
    const today = todayStr();
    return members
      .filter(
        (m) =>
          (branchId === "all" || m.branchId === branchId) &&
          ["active", "expiring"].includes(memberStatus(m))
      )
      .map((m) => ({ m, ref: m.lastVisit || m.membershipStart || today }))
      .filter((x) => daysBetween(x.ref, today) >= 14)
      .sort((a, b) => a.ref.localeCompare(b.ref))
      .slice(0, 8);
  }, [members, branchId]);

  // Decide whether this member may enter
  const validate = (m: Member): { level: "ok" | "warn" | "block"; message: string } => {
    const st = memberStatus(m);
    if (st === "archived") return { level: "block", message: "This member is archived." };
    if (st === "no_plan") return { level: "block", message: "This member has no membership yet." };
    if (st === "frozen") return { level: "block", message: "The membership is frozen." };
    if (st === "expired") {
      return {
        level: "block",
        message: `The membership expired on ${fmtDate(m.membershipEnd)}.`,
      };
    }
    const plan = plans.find((p) => p.id === m.membershipPlanId);
    if (plan && (plan.branchIds ?? []).length > 0 && !plan.branchIds.includes(checkBranchId)) {
      return {
        level: "block",
        message: `The ${plan.name} plan is not valid at ${checkBranch?.name ?? "this branch"}.`,
      };
    }
    if (st === "expiring") {
      return {
        level: "warn",
        message: `Membership ends soon: ${expiryText(m.membershipEnd).toLowerCase()}.`,
      };
    }
    return { level: "ok", message: `Valid until ${fmtDate(m.membershipEnd)}.` };
  };

  // Writes the visit and updates the member. Used by the desk and by the QR scanner.
  const recordCheckIn = async (m: Member, override: boolean, reason: string) => {
    if (!businessId || !checkBranch) throw new Error("No branch selected.");

    const today = todayStr();
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "businesses", businessId, "attendance")), {
      memberId: m.id,
      memberName: m.name,
      memberCode: m.code,
      branchId: checkBranch.id,
      branchName: checkBranch.name,
      date: today,
      checkInAt: serverTimestamp(),
      checkOutAt: null,
      planName: m.membershipPlan ?? "",
      entryStatus: memberStatus(m),
      override,
      overrideReason: reason.trim(),
    });
    batch.update(doc(db, "businesses", businessId, "members", m.id), {
      lastVisit: today,
      visitCount: increment(1),
    });
    await batch.commit();
  };

  const checkIn = async (m: Member, override = false, reason = "") => {
    if (!businessId) return;
    if (!checkBranch) {
      setNotice({
        kind: "error",
        title: "Select a branch",
        text: "Choose the branch where the member is checking in.",
      });
      return;
    }

    const already = sessions.find((s) => s.memberId === m.id && !s.checkOutAt);
    if (already) {
      setNotice({
        kind: "info",
        title: `${m.name} is already inside`,
        text: `Checked in at ${fmtTime(already.checkInAt)}. Use "Check out" below when they leave.`,
      });
      setQ("");
      return;
    }

    const v = validate(m);
    if (v.level === "block" && !override) {
      setPending(m);
      setOverrideReason("");
      return;
    }

    setBusy(true);
    try {
      await recordCheckIn(m, override, reason);

      setPending(null);
      setQ("");
      setNotice(
        override
          ? {
              kind: "warning",
              title: `${m.name} checked in (override)`,
              text: `${v.message} Entry was allowed manually.`,
            }
          : {
              kind: v.level === "warn" ? "warning" : "success",
              title: `${m.name} checked in`,
              text: v.message,
            }
      );
      searchRef.current?.focus();
    } catch {
      setNotice({
        kind: "error",
        title: "Check-in failed",
        text: "Could not save the check-in. Please check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async (s: AttendanceRecord) => {
    if (!businessId) return;
    await updateDoc(doc(db, "businesses", businessId, "attendance", s.id), {
      checkOutAt: serverTimestamp(),
    });
  };

  const checkOutAll = async () => {
    if (!businessId || inside.length === 0) return;
    if (!window.confirm(`Check out all ${inside.length} member(s) who are still inside?`)) return;
    const batch = writeBatch(db);
    inside.forEach((s) =>
      batch.update(doc(db, "businesses", businessId, "attendance", s.id), {
        checkOutAt: serverTimestamp(),
      })
    );
    await batch.commit();
  };

  // One QR scan from the camera: find the member, check them in (or out) and report back
  const processScan = async (raw: string, opts: { checkout: boolean }): Promise<ScanResult> => {
    const code = raw.trim();
    const term = code.toLowerCase();
    const m =
      members.find((x) => x.code.toLowerCase() === term) ??
      members.find((x) => x.phone === code);

    if (!m) {
      return {
        kind: "error",
        title: "Unknown QR code",
        text: `No member matches "${code.slice(0, 40)}".`,
      };
    }
    if (!checkBranch) {
      return {
        kind: "error",
        title: "Select a branch",
        text: "Choose the branch where members are checking in.",
      };
    }

    const already = sessions.find((s) => s.memberId === m.id && !s.checkOutAt);
    if (already) {
      if (opts.checkout) {
        const stayed = fmtDuration(minutesSince(already.checkInAt));
        await checkOut(already);
        return {
          kind: "info",
          title: `${m.name} checked out`,
          text: `Was inside for ${stayed}. See you next time!`,
          member: m,
        };
      }
      return {
        kind: "info",
        title: `${m.name} is already inside`,
        text: `Checked in at ${fmtTime(already.checkInAt)}.`,
        member: m,
      };
    }

    const v = validate(m);
    if (v.level === "block") {
      return {
        kind: "error",
        title: "Entry blocked",
        text: `${m.name} (${m.code}): ${v.message}`,
        member: m,
        canOverride: memberStatus(m) !== "archived",
      };
    }

    await recordCheckIn(m, false, "");
    return {
      kind: v.level === "warn" ? "warning" : "success",
      title: `Welcome, ${m.name.split(" ")[0]}`,
      text: v.message,
      member: m,
    };
  };

  // Pressing Enter (or a scanner sending Enter) checks in the exact match
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim().toLowerCase();
    if (!term) return;

    const exact = candidates.find(
      (m) => m.code.toLowerCase() === term || m.phone === q.trim()
    );
    const target = exact ?? (candidates.length === 1 ? candidates[0] : undefined);

    if (target) {
      void checkIn(target);
    } else if (candidates.length === 0) {
      setNotice({
        kind: "error",
        title: "No member found",
        text: `Nothing matches "${q.trim()}". Check the spelling or the member code.`,
      });
    }
  };

  const pendingCheck = pending ? validate(pending) : null;

  const cards = [
    { label: "Check-ins", value: String(stats.visits), sub: "Total visits", icon: LogIn },
    { label: "Unique Members", value: String(stats.unique), sub: "Different members", icon: Users },
    {
      label: isToday ? "Currently Inside" : "No Check-out",
      value: String(inside.length),
      sub: isToday ? "In the gym right now" : "Visits without a check-out",
      icon: CheckCircle2,
    },
    {
      label: "Average Stay",
      value: stats.avg === null ? "—" : fmtDuration(stats.avg),
      sub: "Per completed visit",
      icon: Clock,
    },
  ];

  if (!loaded.members || !loaded.sessions) {
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
            Attendance & <span className="gold-text">Access</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Check members in and out, validate memberships and see who is in the gym.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="input-lux !w-auto !py-2.5 !pl-4 text-sm"
          />
          {!isToday && (
            <button
              onClick={() => setDate(todayStr())}
              className="rounded-lg border border-line px-4 py-2.5 text-sm text-muted transition hover:border-gold/50 hover:text-charcoal"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {error && <p className="card p-5 text-center text-sm text-red-700">{error}</p>}

      {notice && (
        <div className={`rounded-2xl border p-4 ${noticeStyle[notice.kind]}`}>
          <p className="font-medium">{notice.title}</p>
          <p className="mt-0.5 text-sm">{notice.text}</p>
        </div>
      )}

      {/* Blocked entry */}
      {pending && pendingCheck && (
        <div className="card !border-red-300 p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-600">
              <ShieldAlert size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl font-semibold">Entry blocked</p>
              <p className="mt-1 text-sm">
                <b>{pending.name}</b> ({pending.code}): {pendingCheck.message}
              </p>

              {memberStatus(pending) === "archived" ? (
                <p className="mt-3 text-sm text-muted">
                  Restore this member from their profile before checking them in.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-sm text-muted">
                    You can still allow entry. Please enter a reason. It will be saved in the
                    visit record.
                  </p>
                  <input
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="e.g. Renewal payment coming today"
                    className="input-lux mt-3 !pl-4"
                  />
                </>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {memberStatus(pending) !== "archived" && (
                  <button
                    disabled={busy || !overrideReason.trim()}
                    onClick={() => checkIn(pending, true, overrideReason)}
                    className="btn-gold px-5 py-2.5 text-sm disabled:cursor-not-allowed"
                  >
                    Allow entry anyway
                  </button>
                )}
                <Link
                  to={`/app/members/${pending.id}`}
                  className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:border-gold/50 hover:text-charcoal"
                >
                  Open profile
                </Link>
                <button
                  onClick={() => setPending(null)}
                  className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:text-charcoal"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check-in desk */}
      {isToday && (
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-charcoal text-gold-light">
                <ScanLine size={20} />
              </div>
              <div>
                <h3 className="font-display text-xl">Check-in Desk</h3>
                <p className="text-sm text-muted">
                  Scan the member's QR card with the camera, or search by name, phone or code.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {branchId === "all" && activeBranches.length > 0 && (
                <select
                  value={checkBranchId}
                  onChange={(e) => setDeskBranch(e.target.value)}
                  className="input-lux !w-auto !py-2.5 !pl-4 text-sm"
                >
                  {activeBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      Check in at: {b.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setScanOpen(true)}
                disabled={!checkBranch}
                className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm disabled:cursor-not-allowed"
              >
                <Camera size={16} /> Scan QR with camera
              </button>
            </div>
          </div>

          {activeBranches.length === 0 ? (
            <p className="mt-5 text-sm text-muted">
              Add an active branch first to start checking members in.{" "}
              <Link to="/app/branches" className="text-gold-soft underline">
                Go to Branches
              </Link>
            </p>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="relative mt-5">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  ref={searchRef}
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Name, phone or member code (e.g. M-0001). A USB barcode scanner works here too."
                  className="input-lux !py-3.5 text-base"
                />
              </form>

              {q.trim() && candidates.length === 0 && (
                <p className="mt-4 text-sm text-muted">No member found.</p>
              )}

              {candidates.length > 0 && (
                <div className="mt-4 space-y-2">
                  {candidates.map((m) => {
                    const st = memberStatus(m);
                    const isInside = sessions.some((s) => s.memberId === m.id && !s.checkOutAt);
                    return (
                      <div
                        key={m.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white/60 p-3"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal">
                          {m.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {m.name}{" "}
                            <span className="text-xs font-normal text-muted">· {m.code}</span>
                          </p>
                          <p className="text-xs text-muted">
                            {m.phone} · {m.membershipPlan || "No membership"}
                            {m.membershipEnd ? ` · until ${fmtDate(m.membershipEnd)}` : ""}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${statusMeta[st].cls}`}>
                          {statusMeta[st].label}
                        </span>
                        <button
                          disabled={busy || isInside}
                          onClick={() => checkIn(m)}
                          className="btn-gold flex items-center gap-1.5 px-4 py-2 text-sm disabled:cursor-not-allowed"
                        >
                          <LogIn size={15} /> {isInside ? "Inside" : "Check in"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Stats */}
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
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-charcoal"}`}>
                {label}
              </p>
              <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>
                {sub}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="card p-6 xl:col-span-2">
          <h3 className="font-display text-xl">Check-ins by Hour</h3>
          <p className="text-sm text-muted">
            {peak && peak.v > 0
              ? `Busiest time: ${peak.h} (${peak.v} check-in${peak.v === 1 ? "" : "s"})`
              : "No check-ins on this day yet."}
          </p>
          <div className="mt-6 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid stroke="rgba(40,30,10,0.07)" vertical={false} />
                <XAxis
                  dataKey="h"
                  stroke="#7a7466"
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                  fontSize={11}
                />
                <YAxis
                  stroke="#7a7466"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(v) => [v, "Check-ins"]}
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid rgba(201,162,39,0.4)",
                    borderRadius: 12,
                    color: "#17151f",
                  }}
                />
                <Bar dataKey="v" fill="#c9a227" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display text-xl">Not Seen Lately</h3>
          <p className="text-sm text-muted">Active members with no visit for 14+ days</p>

          {inactive.length === 0 ? (
            <div className="mt-6 grid place-items-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
                <UserX size={20} />
              </div>
              <p className="mt-3 text-sm text-muted">Everyone is visiting regularly.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {inactive.map(({ m, ref }) => (
                <Link
                  key={m.id}
                  to={`/app/members/${m.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3 transition hover:border-gold/40"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-charcoal text-sm font-semibold text-gold-light">
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted">
                      {m.lastVisit
                        ? `Last visit ${daysBetween(ref, todayStr())} days ago`
                        : "Has not visited yet"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Currently inside */}
      {isToday && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-6 pb-4">
            <div>
              <h3 className="font-display text-xl">Currently Inside</h3>
              <p className="text-sm text-muted">{inside.length} member(s) in the gym</p>
            </div>
            {inside.length > 0 && (
              <button
                onClick={checkOutAll}
                className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-charcoal"
              >
                <LogOut size={15} /> Check out everyone
              </button>
            )}
          </div>

          {inside.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted">Nobody is checked in right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                    <th className="px-6 py-3 font-medium">Member</th>
                    <th className="px-6 py-3 font-medium">Branch</th>
                    <th className="px-6 py-3 font-medium">Checked in</th>
                    <th className="px-6 py-3 font-medium">Inside for</th>
                    <th className="px-6 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inside.map((s) => (
                    <tr key={s.id} className="border-b border-line/60 last:border-0">
                      <td className="px-6 py-3">
                        <Link to={`/app/members/${s.memberId}`} className="font-medium hover:underline">
                          {s.memberName}
                        </Link>
                        <p className="text-xs text-muted">{s.memberCode}</p>
                      </td>
                      <td className="px-6 py-3 text-muted">{s.branchName}</td>
                      <td className="px-6 py-3">{fmtTime(s.checkInAt)}</td>
                      <td className="px-6 py-3 text-muted">
                        {fmtDuration(minutesSince(s.checkInAt))}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => checkOut(s)}
                          className="flex items-center gap-1.5 rounded-lg bg-gold/15 px-3.5 py-1.5 text-xs font-medium text-gold-soft transition hover:bg-gold/25"
                          style={{ marginLeft: "auto" }}
                        >
                          <LogOut size={13} /> Check out
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All visits of the day */}
      <div className="card overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="font-display text-xl">
            {isToday ? "Today's Visits" : `Visits on ${fmtDate(date)}`}
          </h3>
        </div>

        {scopedSessions.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted">No visits recorded for this day.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-3 font-medium">Member</th>
                  <th className="px-6 py-3 font-medium">Branch</th>
                  <th className="px-6 py-3 font-medium">Check-in</th>
                  <th className="px-6 py-3 font-medium">Check-out</th>
                  <th className="px-6 py-3 font-medium">Duration</th>
                  <th className="px-6 py-3 font-medium">Entry</th>
                </tr>
              </thead>
              <tbody>
                {scopedSessions.map((s) => {
                  const closed = s.checkInAt && s.checkOutAt;
                  return (
                    <tr key={s.id} className="border-b border-line/60 last:border-0">
                      <td className="px-6 py-3">
                        <Link to={`/app/members/${s.memberId}`} className="font-medium hover:underline">
                          {s.memberName}
                        </Link>
                        <p className="text-xs text-muted">{s.planName || "—"}</p>
                      </td>
                      <td className="px-6 py-3 text-muted">{s.branchName}</td>
                      <td className="px-6 py-3">{fmtTime(s.checkInAt)}</td>
                      <td className="px-6 py-3">{s.checkOutAt ? fmtTime(s.checkOutAt) : "—"}</td>
                      <td className="px-6 py-3 text-muted">
                        {closed
                          ? fmtDuration(
                              Math.round((s.checkOutAt!.seconds - s.checkInAt!.seconds) / 60)
                            )
                          : isToday
                            ? "Inside"
                            : "No check-out"}
                      </td>
                      <td className="px-6 py-3">
                        {s.override ? (
                          <span
                            title={s.overrideReason}
                            className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700"
                          >
                            Override
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700">
                            Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR scanner */}
      {scanOpen && checkBranch && (
        <QrScannerModal
          branchName={checkBranch.name}
          onScan={processScan}
          onOverride={(m) => {
            setScanOpen(false);
            setPending(m);
            setOverrideReason("");
          }}
          onClose={() => setScanOpen(false)}
        />
      )}
    </div>
  );
}
