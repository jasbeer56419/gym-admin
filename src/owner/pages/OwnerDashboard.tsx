import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Circle,
  Clock,
  IndianRupee,
  UserPlus,
  Users,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import type { Member, MemberPayment } from "../../types";
import { useOwner } from "../OwnerContext";
import { daysBetween, expiryText, fmtDate, memberStatus, rupee, todayStr } from "../utils";

const limitText = (n: number) => (n === 0 ? "Unlimited" : n.toLocaleString("en-IN"));

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function OwnerDashboard() {
  const { profile } = useAuth();
  const { businessId, business, plan, branches, branchId } = useOwner();

  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<MemberPayment[]>([]);
  const [planCount, setPlanCount] = useState(0);

  useEffect(() => {
    if (!businessId) return;
    const u1 = onSnapshot(collection(db, "businesses", businessId, "members"), (snap) =>
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member))
    );
    const u2 = onSnapshot(collection(db, "businesses", businessId, "payments"), (snap) =>
      setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MemberPayment))
    );
    const u3 = onSnapshot(collection(db, "businesses", businessId, "membershipPlans"), (snap) =>
      setPlanCount(snap.size)
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, [businessId]);

  const firstName = profile?.name.split(" ")[0] || "there";

  const live = useMemo(() => members.filter((m) => !m.archived), [members]);

  // Numbers follow the branch switcher in the top bar
  const scoped = useMemo(
    () => live.filter((m) => branchId === "all" || m.branchId === branchId),
    [live, branchId]
  );

  const stats = useMemo(() => {
    const month = todayStr().slice(0, 7);
    const monthOf = (m: Member) => {
      const d = m.createdAt?.toDate() ?? new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };
    const revenue = payments
      .filter((p) => (branchId === "all" || p.branchId === branchId) && p.date.startsWith(month))
      
            .reduce((sum, p) => sum + p.amount - (p.refundedAmount ?? 0), 0);

    return {
      active: scoped.filter((m) => ["active", "expiring"].includes(memberStatus(m))).length,
      expiring: scoped.filter((m) => memberStatus(m) === "expiring").length,
      newThisMonth: scoped.filter((m) => monthOf(m) === month).length,
      revenue,
    };
  }, [scoped, payments, branchId]);

  const expiringSoon = useMemo(
    () =>
      scoped
        .filter((m) => memberStatus(m) === "expiring")
        .sort((a, b) => a.membershipEnd.localeCompare(b.membershipEnd))
        .slice(0, 6),
    [scoped]
  );

  const recent = useMemo(
    () =>
      [...scoped]
        .sort((a, b) => (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12))
        .slice(0, 5),
    [scoped]
  );

  const maxMembers = plan?.maxMembers ?? 0;
  const maxBranches = plan?.maxBranches ?? 0;
  const memberPct = maxMembers === 0 ? 0 : Math.min(100, (live.length / maxMembers) * 100);
  const branchPct =
    maxBranches === 0 ? 0 : Math.min(100, (branches.length / maxBranches) * 100);

  const cards = [
    {
      label: "Active Members",
      value: String(stats.active),
      sub: `${scoped.length} total`,
      icon: Users,
    },
    {
      label: "Expiring in 7 Days",
      value: String(stats.expiring),
      sub: "Renewal follow-ups needed",
      icon: Clock,
    },
    {
      label: "Revenue This Month",
      value: rupee(stats.revenue),
      sub: "Payments received",
      icon: IndianRupee,
    },
    {
      label: "New This Month",
      value: String(stats.newThisMonth),
      sub: "Newly registered members",
      icon: UserPlus,
    },
  ];

  const steps = [
    { label: "Business registered", note: "Your gym is set up on the platform.", done: true },
    {
      label: "Add your first branch",
      note: "Create at least one gym location.",
      done: branches.length > 0,
      to: "/app/branches",
    },
    {
      label: "Create membership plans",
      note: "Define what your members can buy.",
      done: planCount > 0,
      to: "/app/memberships",
    },
    {
      label: "Register your first member",
      note: "Start building your member base.",
      done: members.length > 0,
      to: "/app/members",
    },
    {
      label: "Add trainers and staff",
      note: "Give your team their own logins.",
      done: false,
      soon: true,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">{business?.name}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          {greeting()}, <span className="gold-text">{firstName}</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Here is how your gym is doing
          {branchId === "all" ? " across all branches." : " at the selected branch."}
        </p>
      </div>

      {/* KPI cards */}
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
        {/* Expiring soon */}
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-xl">Expiring Soon</h3>
              <p className="text-sm text-muted">Memberships ending within 7 days</p>
            </div>
            <Link
              to="/app/members"
              className="flex items-center gap-1 text-sm text-gold-soft hover:underline"
            >
              All members <ArrowRight size={14} />
            </Link>
          </div>

          {expiringSoon.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              No memberships are expiring in the next 7 days.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {expiringSoon.map((m) => (
                <Link
                  key={m.id}
                  to={`/app/members/${m.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3 transition hover:border-gold/40"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal">
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted">
                      {m.membershipPlan} · ends {fmtDate(m.membershipEnd)}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-700">
                    {daysBetween(todayStr(), m.membershipEnd) === 0
                      ? "Today"
                      : expiryText(m.membershipEnd)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Capacity */}
        <div className="card p-6">
          <h3 className="font-display text-xl">Plan Usage</h3>
          <p className="text-sm text-muted">
            {plan?.name ?? business?.plan ?? "Current"} plan
            {plan ? ` · ${rupee(plan.priceMonthly)}/month` : ""}
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span>Members</span>
                <span className="text-muted">
                  {live.length} / {limitText(maxMembers)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gold/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
                  style={{ width: `${memberPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span>Branches</span>
                <span className="text-muted">
                  {branches.length} / {limitText(maxBranches)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gold/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold"
                  style={{ width: `${branchPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 rounded-xl border border-gold/25 bg-gold/10 p-3 text-xs text-gold-soft">
            <BadgeCheck size={16} className="shrink-0" />
            Need a bigger plan? Contact the platform administrator.
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Recent members */}
        <div className="card p-6 xl:col-span-2">
          <h3 className="font-display text-xl">Recently Joined</h3>
          <p className="text-sm text-muted">Your newest members</p>

          {recent.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No members yet.</p>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {recent.map((m) => (
                <Link
                  key={m.id}
                  to={`/app/members/${m.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3 transition hover:border-gold/40"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-charcoal font-semibold text-gold-light">
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted">
                      {m.membershipPlan || "No membership"} · {m.branchName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="card p-6">
          <h3 className="font-display text-xl">Getting Started</h3>
          <p className="text-sm text-muted">Set up your gym in a few steps</p>

          <div className="mt-6 space-y-4">
            {steps.map((s) => (
              <div key={s.label} className="flex items-start gap-3">
                <div
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                    s.done ? "bg-emerald-500/15 text-emerald-700" : "bg-black/5 text-muted"
                  }`}
                >
                  {s.done ? <Check size={14} /> : <Circle size={10} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${s.done ? "text-muted line-through" : ""}`}
                  >
                    {s.label}
                  </p>
                  <p className="text-xs text-muted">{s.note}</p>
                </div>
                {s.soon && (
                  <span className="shrink-0 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] text-gold-soft">
                    Soon
                  </span>
                )}
                {!s.done && s.to && (
                  <Link to={s.to} className="shrink-0 text-xs text-gold-soft hover:underline">
                    Start
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
