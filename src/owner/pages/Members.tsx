import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { db } from "../../firebase";
import type { Member, MemberInput, MembershipPlan } from "../../types";
import { useOwner } from "../OwnerContext";
import { expiryText, fmtDate, memberStatus, statusMeta, type MemberStatus } from "../utils";
import { createMember } from "../memberService";
import MemberModal from "../components/MemberModal";
import AssignMembershipModal, { type AssignMode } from "../components/AssignMembershipModal";
import { usePermissions } from "../permissions";

type Filter = "all" | MemberStatus;

const CHIPS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expiring", label: "Expiring soon" },
  { key: "expired", label: "Expired" },
  { key: "frozen", label: "Frozen" },
  { key: "no_plan", label: "No membership" },
  { key: "archived", label: "Archived" },
];

export default function Members() {
  const { businessId, plan, branches, branchId } = useOwner();
  const { can } = usePermissions();
  const canWrite = can("members.write");
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [assign, setAssign] = useState<{ member: Member; mode: AssignMode } | null>(null);

  useEffect(() => {
    if (!businessId) return;

    const unsubMembers = onSnapshot(
      collection(db, "businesses", businessId, "members"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member);
        list.sort(
          (a, b) => (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
        );
        setMembers(list);
        setLoading(false);
      },
      () => {
        setLoadError("Could not load members. Please try again.");
        setLoading(false);
      }
    );

    const unsubPlans = onSnapshot(
      collection(db, "businesses", businessId, "membershipPlans"),
      (snap) => setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MembershipPlan))
    );

    return () => {
      unsubMembers();
      unsubPlans();
    };
  }, [businessId]);

  const activeBranches = branches.filter((b) => b.status === "active");

  // Plan limit (0 = unlimited). If the plan cannot be found, allow 50 to stay safe.
  const maxMembers = plan ? plan.maxMembers : 50;
  const totalMembers = members.filter((m) => !m.archived).length;
  const atLimit = maxMembers !== 0 && totalMembers >= maxMembers;

  // Respect the branch switcher in the top bar
  const scoped = useMemo(
    () => members.filter((m) => branchId === "all" || m.branchId === branchId),
    [members, branchId]
  );

  const stats = useMemo(() => {
    const live = scoped.filter((m) => !m.archived);
    const st = live.map(memberStatus);
    return {
      total: live.length,
      active: st.filter((s) => s === "active" || s === "expiring").length,
      expiring: st.filter((s) => s === "expiring").length,
      expired: st.filter((s) => s === "expired").length,
    };
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((m) => {
      const st = memberStatus(m);
      const okStatus =
        filter === "all"
          ? st !== "archived"
          : filter === "active"
            ? st === "active" || st === "expiring"
            : st === filter;
      const okSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.code.toLowerCase().includes(q);
      return okStatus && okSearch;
    });
  }, [scoped, search, filter]);

  const handleRegister = async (data: MemberInput) => {
    if (!businessId) return;
    if (atLimit) {
      throw new Error(
        `Your plan allows up to ${maxMembers} members. Please contact the platform administrator to upgrade.`
      );
    }
    if (members.some((m) => !m.archived && m.phone.trim() === data.phone.trim())) {
      throw new Error("A member with this phone number already exists.");
    }

    const member = await createMember(businessId, data, branches);

    // Straight to the membership step
    setAssign({ mode: "new", member });
  };

  const cards = [
    { label: "Total Members", value: stats.total, icon: Users },
    { label: "Active", value: stats.active, icon: CheckCircle2 },
    { label: "Expiring in 7 days", value: stats.expiring, icon: Clock },
    { label: "Expired", value: stats.expired, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">People</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Your <span className="gold-text">Members</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Register members, manage memberships and track renewals.
          </p>
        </div>
        <button
          onClick={() => setRegisterOpen(true)}
          disabled={atLimit || activeBranches.length === 0 || !canWrite}
          title={
            activeBranches.length === 0
              ? "Add a branch first"
              : atLimit
                ? "Member limit reached"
                : "Register a new member"
          }
          className="btn-gold flex items-center gap-2 px-5 py-3 text-sm disabled:cursor-not-allowed"
        >
          <UserPlus size={18} /> Add Member
        </button>
      </div>

      {activeBranches.length === 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 !border-gold/50 p-5">
          <p className="text-sm">You need at least one active branch before registering members.</p>
          <Link to="/app/branches" className="btn-gold px-5 py-2 text-sm">
            Add a branch
          </Link>
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm">
          <b>{totalMembers}</b> of <b>{maxMembers === 0 ? "unlimited" : maxMembers}</b> members
          used on your <b>{plan?.name ?? "current"}</b> plan.
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
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-muted"}`}>
                {label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              placeholder="Search by name, phone or member code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-lux !py-2.5 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`rounded-lg border px-3.5 py-2 text-sm transition ${
                  filter === c.key
                    ? "border-gold/50 bg-gold/15 text-gold-soft"
                    : "border-line text-muted hover:text-charcoal"
                }`}
              >
                {c.label}
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
            <p className="mt-4 font-display text-xl">
              {members.length === 0 ? "No members yet" : "No matches found"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {members.length === 0
                ? "Click \"Add Member\" to register your first member."
                : "Try a different search, filter or branch."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-4 font-medium">Member</th>
                  <th className="px-6 py-4 font-medium">Phone</th>
                  <th className="px-6 py-4 font-medium">Branch</th>
                  <th className="px-6 py-4 font-medium">Membership</th>
                  <th className="px-6 py-4 font-medium">Expires</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const st = memberStatus(m);
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-line/60 transition last:border-0 hover:bg-gold/5"
                    >
                      <td className="px-6 py-4">
                        <Link to={`/app/members/${m.id}`} className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-semibold text-charcoal">
                            {m.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium hover:underline">{m.name}</p>
                            <p className="text-xs text-muted">{m.code}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-muted">{m.phone}</td>
                      <td className="px-6 py-4 text-muted">{m.branchName || "—"}</td>
                      <td className="px-6 py-4">
                        {m.membershipPlan ? (
                          <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs text-gold-soft">
                            {m.membershipPlan}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {m.membershipEnd ? (
                          <>
                            <p>{fmtDate(m.membershipEnd)}</p>
                            <p className="text-xs text-muted">{expiryText(m.membershipEnd)}</p>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${statusMeta[st].cls}`}
                        >
                          {statusMeta[st].label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite && st === "no_plan" && (
                            <button
                              onClick={() => setAssign({ member: m, mode: "new" })}
                              className="rounded-lg bg-gold/15 px-3 py-1.5 text-xs font-medium text-gold-soft transition hover:bg-gold/25"
                            >
                              Assign
                            </button>
                          )}

                          {canWrite &&
                            (st === "active" || st === "expiring" || st === "expired") && (
                              <button
                                title="Renew"
                                onClick={() => setAssign({ member: m, mode: "renew" })}
                                className="flex items-center gap-1 rounded-lg bg-gold/15 px-3 py-1.5 text-xs font-medium text-gold-soft transition hover:bg-gold/25"
                              >
                                <RefreshCw size={13} /> Renew
                              </button>
                            )}
                          <Link
                            to={`/app/members/${m.id}`}
                            title="View profile"
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            <Eye size={16} />
                          </Link>
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

      {registerOpen && (
        <MemberModal
          member={null}
          branches={activeBranches}
          defaultBranchId={
            branchId !== "all" && activeBranches.some((b) => b.id === branchId)
              ? branchId
              : (activeBranches[0]?.id ?? "")
          }
          onClose={() => setRegisterOpen(false)}
          onSave={handleRegister}
        />
      )}

      {assign && businessId && (
        <AssignMembershipModal
          key={`${assign.member.id}-${assign.mode}`}
          businessId={businessId}
          member={assign.member}
          mode={assign.mode}
          plans={plans}
          onClose={() => setAssign(null)}
        />
      )}
    </div>
  );
}
