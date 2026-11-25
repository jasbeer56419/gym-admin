import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import type { Lead, LeadInput, Member, MemberInput, MembershipPlan } from "../../types";
import { useOwner } from "../OwnerContext";
import { usePermissions } from "../permissions";
import { createMember } from "../memberService";
import { LEAD_STATUS, followUpInfo, isOpen, waLink } from "../leadUtils";
import { addDays, addMonths, fmtDate, toStr, todayStr } from "../utils";
import LeadModal from "../components/LeadModal";
import FollowUpModal from "../components/FollowUpModal";
import MemberModal from "../components/MemberModal";
import AssignMembershipModal, { type AssignMode } from "../components/AssignMembershipModal";

type Filter = "open" | "due" | "all" | Lead["status"];
type DateField = "created" | "followup";
type Period = "all" | "today" | "7d" | "month" | "30d" | "custom";

const CHIPS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "due", label: "Follow-up due" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "trial", label: "Trial booked" },
  { key: "negotiation", label: "Negotiation" },
  { key: "converted", label: "Converted" },
  { key: "lost", label: "Lost" },
  { key: "all", label: "All" },
];

const periodLabels = (field: DateField): { key: Period; label: string }[] => [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "7d", label: field === "followup" ? "Next 7 days" : "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "30d", label: field === "followup" ? "Next 30 days" : "Last 30 days" },
  { key: "custom", label: "Custom" },
];

// Turns the chosen period into a from/to date range (null = no filter)
const rangeFor = (
  period: Period,
  field: DateField,
  today: string,
  customFrom: string,
  customTo: string
): { from: string; to: string } | null => {
  const future = field === "followup";
  const monthStart = `${today.slice(0, 7)}-01`;

  switch (period) {
    case "all":
      return null;
    case "today":
      return { from: today, to: today };
    case "7d":
      return future
        ? { from: today, to: addDays(today, 6) }
        : { from: addDays(today, -6), to: today };
    case "30d":
      return future
        ? { from: today, to: addDays(today, 29) }
        : { from: addDays(today, -29), to: today };
    case "month":
      return { from: monthStart, to: addDays(addMonths(monthStart, 1), -1) };
    case "custom": {
      if (!customFrom && !customTo) return null;
      const a = customFrom || "0000-01-01";
      const b = customTo || "9999-12-31";
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
  }
};

export default function Leads() {
  const { businessId, plan, branches, branchId } = useOwner();
  const { profile } = useAuth();
  const { can } = usePermissions();
  const actor = profile?.name || "Staff";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("open");

  // Date filter
  const [dateField, setDateField] = useState<DateField>("created");
  const [period, setPeriod] = useState<Period>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [leadModal, setLeadModal] = useState<{ open: boolean; lead: Lead | null }>({
    open: false,
    lead: null,
  });
  const [followLead, setFollowLead] = useState<Lead | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [assign, setAssign] = useState<{ member: Member; mode: AssignMode } | null>(null);

  useEffect(() => {
    if (!businessId) return;

    const u1 = onSnapshot(
      collection(db, "businesses", businessId, "leads"),
      (snap) => {
        setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Lead));
        setLoading(false);
      },
      () => {
        setLoadError("Could not load leads. Please try again.");
        setLoading(false);
      }
    );
    const u2 = onSnapshot(collection(db, "businesses", businessId, "members"), (snap) =>
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member))
    );
    const u3 = onSnapshot(collection(db, "businesses", businessId, "membershipPlans"), (snap) =>
      setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MembershipPlan))
    );
    return () => {
      u1();
      u2();
      u3();
    };
  }, [businessId]);

  const activeBranches = branches.filter((b) => b.status === "active");
  const today = todayStr();
  const month = today.slice(0, 7);

  const maxMembers = plan ? plan.maxMembers : 50;
  const totalMembers = members.filter((m) => !m.archived).length;
  const atLimit = maxMembers !== 0 && totalMembers >= maxMembers;

  const scoped = useMemo(
    () => leads.filter((l) => branchId === "all" || l.branchId === branchId),
    [leads, branchId]
  );

  // ---------- Date filter ----------

  const range = rangeFor(period, dateField, today, customFrom, customTo);

  // The date this lead is filtered on (a brand new lead has no server time yet, so use today)
  const dateOf = (l: Lead) =>
    dateField === "followup"
      ? l.nextFollowUp
      : l.createdAt
        ? toStr(l.createdAt.toDate())
        : today;

  const inRange = (l: Lead) => {
    if (!range) return true;
    const d = dateOf(l);
    return !!d && d >= range.from && d <= range.to;
  };

  // Leads inside the chosen date range (the list and the chip counts use this)
  const dated = useMemo(
    () => scoped.filter(inRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, dateField, range?.from, range?.to]
  );

  const rangeText = range
    ? period === "custom" && !customFrom
      ? `up to ${fmtDate(range.to)}`
      : period === "custom" && !customTo
        ? `from ${fmtDate(range.from)}`
        : range.from === range.to
          ? `on ${fmtDate(range.from)}`
          : `from ${fmtDate(range.from)} to ${fmtDate(range.to)}`
    : "";

  const clearDates = () => {
    setPeriod("all");
    setCustomFrom("");
    setCustomTo("");
  };

  // ---------- Status filter ----------

  const matches = (l: Lead, f: Filter) => {
    if (f === "all") return true;
    if (f === "open") return isOpen(l.status);
    if (f === "due") return isOpen(l.status) && !!l.nextFollowUp && l.nextFollowUp <= today;
    return l.status === f;
  };

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    CHIPS.forEach((chip) => (c[chip.key] = dated.filter((l) => matches(l, chip.key)).length));
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dated, today]);

  // The 4 cards show the live pipeline, so the date filter does not change them
  const stats = useMemo(() => {
    const converted = scoped.filter((l) => l.status === "converted");
    return {
      open: scoped.filter((l) => isOpen(l.status)).length,
      due: scoped.filter((l) => matches(l, "due")).length,
      convertedMonth: converted.filter((l) => (l.convertedOn ?? "").startsWith(month)).length,
      rate: scoped.length === 0 ? 0 : Math.round((converted.length / scoped.length) * 100),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, today]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dated
      .filter(
        (l) =>
          matches(l, filter) &&
          (!q || l.name.toLowerCase().includes(q) || l.phone.includes(q))
      )
      .sort(
        (a, b) =>
          Number(!isOpen(a.status)) - Number(!isOpen(b.status)) ||
          (a.nextFollowUp || "9999").localeCompare(b.nextFollowUp || "9999") ||
          (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dated, search, filter, today]);

  const handleSave = async (data: LeadInput) => {
    if (!businessId) return;
    const branch = branches.find((b) => b.id === data.branchId);

    if (leadModal.lead) {
      await updateDoc(doc(db, "businesses", businessId, "leads", leadModal.lead.id), {
        ...data,
        branchName: branch?.name ?? leadModal.lead.branchName,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (leads.some((l) => isOpen(l.status) && l.phone.trim() === data.phone)) {
      throw new Error("An open lead with this phone number already exists.");
    }
    if (members.some((m) => !m.archived && m.phone.trim() === data.phone)) {
      throw new Error("This person is already a member.");
    }

    await addDoc(collection(db, "businesses", businessId, "leads"), {
      ...data,
      branchName: branch?.name ?? "",
      status: "new",
      lastContact: "",
      lostReason: "",
      memberId: null,
      convertedOn: "",
      activity: [
        {
          at: new Date().toISOString(),
          type: "Created",
          note: `Enquiry added (${data.source})`,
          by: actor,
        },
      ],
      createdByName: actor,
      createdAt: serverTimestamp(),
    });
  };

  const handleConvert = async (data: MemberInput) => {
    if (!businessId || !convertLead) return;
    if (atLimit) {
      throw new Error(
        `Your plan allows up to ${maxMembers} members. Please contact the platform administrator to upgrade.`
      );
    }
    if (members.some((m) => !m.archived && m.phone.trim() === data.phone.trim())) {
      throw new Error("A member with this phone number already exists.");
    }

    const member = await createMember(businessId, data, branches);

    await updateDoc(doc(db, "businesses", businessId, "leads", convertLead.id), {
      status: "converted",
      memberId: member.id,
      convertedOn: todayStr(),
      nextFollowUp: "",
      lostReason: "",
      activity: arrayUnion({
        at: new Date().toISOString(),
        type: "Converted",
        note: `Registered as member ${member.code}`,
        by: actor,
      }),
      updatedAt: serverTimestamp(),
    });

    // Straight to the membership step
    setAssign({ member, mode: "new" });
  };

  const remove = async (l: Lead) => {
    if (!businessId) return;
    if (window.confirm(`Delete the lead "${l.name}"? This cannot be undone.`)) {
      await deleteDoc(doc(db, "businesses", businessId, "leads", l.id));
    }
  };

  const cards = [
    { label: "Open Leads", value: String(stats.open), sub: "Still in the pipeline", icon: Target },
    { label: "Follow-ups Due", value: String(stats.due), sub: "Today or overdue", icon: CalendarClock },
    {
      label: "Converted This Month",
      value: String(stats.convertedMonth),
      sub: "Became members",
      icon: CheckCircle2,
    },
    {
      label: "Conversion Rate",
      value: `${stats.rate}%`,
      sub: `Of ${scoped.length} total lead${scoped.length === 1 ? "" : "s"}`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">People</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Leads & <span className="gold-text">Sales</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Capture enquiries, follow up on time and turn visitors into members.
          </p>
        </div>
        <button
          onClick={() => setLeadModal({ open: true, lead: null })}
          disabled={activeBranches.length === 0}
          title={activeBranches.length === 0 ? "Add a branch first" : "Add a lead"}
          className="btn-gold flex items-center gap-2 px-5 py-3 text-sm disabled:cursor-not-allowed"
        >
          <Plus size={18} /> Add Lead
        </button>
      </div>

      {activeBranches.length === 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 !border-gold/50 p-5">
          <p className="text-sm">You need at least one active branch before adding leads.</p>
          <Link to="/app/branches" className="btn-gold px-5 py-2 text-sm">
            Add a branch
          </Link>
        </div>
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

      <div className="card overflow-hidden">
        {/* Search and status chips */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              placeholder="Search by name or phone..."
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
                {c.label} <span className="text-xs opacity-70">({counts[c.key] ?? 0})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date filter */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-black/[0.015] px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <CalendarDays size={16} className="text-gold-soft" />
            <span>Filter by</span>
          </div>

          <select
            value={dateField}
            onChange={(e) => setDateField(e.target.value as DateField)}
            className="input-lux !w-auto !py-2 !pl-4 text-sm"
          >
            <option value="created">Enquiry date</option>
            <option value="followup">Next follow-up date</option>
          </select>

          <div className="flex flex-wrap gap-2">
            {periodLabels(dateField).map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-lg border px-3.5 py-2 text-sm transition ${
                  period === p.key
                    ? "border-gold/50 bg-gold/15 text-gold-soft"
                    : "border-line text-muted hover:text-charcoal"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="input-lux !w-auto !py-2 !pl-4 text-sm"
                aria-label="From date"
              />
              <span className="text-sm text-muted">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="input-lux !w-auto !py-2 !pl-4 text-sm"
                aria-label="To date"
              />
            </div>
          )}

          {range && (
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="text-muted">
                Showing <b className="text-charcoal">{dated.length}</b> of {scoped.length} leads{" "}
                {rangeText}
              </span>
              <button
                onClick={clearDates}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:border-gold/50 hover:text-charcoal"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid place-items-center p-16">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
          </div>
        ) : loadError ? (
          <p className="p-10 text-center text-sm text-red-700">{loadError}</p>
        ) : rows.length === 0 ? (
          <div className="grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
              <Target size={24} />
            </div>
            <p className="mt-4 font-display text-xl">
              {leads.length === 0 ? "No leads yet" : "No leads found"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {leads.length === 0
                ? "Click \"Add Lead\" when someone enquires about your gym."
                : "Try a different search, status, date range or branch."}
            </p>
            {range && (
              <button
                onClick={clearDates}
                className="mt-4 rounded-lg border border-line px-4 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-charcoal"
              >
                Clear date filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-4 font-medium">Lead</th>
                  <th className="px-6 py-4 font-medium">Interest</th>
                  <th className="px-6 py-4 font-medium">Branch</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Next follow-up</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const open = isOpen(l.status);
                  const fu = open ? followUpInfo(l.nextFollowUp) : null;
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-line/60 transition last:border-0 hover:bg-gold/5"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium">{l.name}</p>
                        <p className="text-xs text-muted">{l.phone}</p>
                        <p className="text-xs text-muted">Enquiry: {fmtDate(dateOfLead(l, today))}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p>{l.interest}</p>
                        <p className="text-xs text-muted">via {l.source}</p>
                      </td>
                      <td className="px-6 py-4 text-muted">{l.branchName || "—"}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${LEAD_STATUS[l.status].cls}`}
                        >
                          {LEAD_STATUS[l.status].label}
                        </span>
                        {l.status === "lost" && l.lostReason && (
                          <p className="mt-1 text-xs text-muted">{l.lostReason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {fu ? (
                          <>
                            <p className={fu.cls}>{fu.text}</p>
                            {l.lastContact && (
                              <p className="text-xs text-muted">
                                Last contact {fmtDate(l.lastContact)}
                              </p>
                            )}
                          </>
                        ) : l.status === "converted" && l.memberId ? (
                          <Link
                            to={`/app/members/${l.memberId}`}
                            className="text-sm text-gold-soft hover:underline"
                          >
                            View member
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            title="Call"
                            href={`tel:${l.phone}`}
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            <Phone size={16} />
                          </a>
                          <a
                            title="WhatsApp"
                            href={waLink(l.phone)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-2 text-muted transition hover:bg-emerald-500/10 hover:text-emerald-700"
                          >
                            <MessageCircle size={16} />
                          </a>
                          {l.status !== "converted" && (
                            <button
                              title="Log follow-up"
                              onClick={() => setFollowLead(l)}
                              className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                            >
                              <PhoneCall size={16} />
                            </button>
                          )}
                          {open && (
                            <button
                              title="Convert to member"
                              onClick={() => setConvertLead(l)}
                              className="flex items-center gap-1 rounded-lg bg-gold/15 px-3 py-1.5 text-xs font-medium text-gold-soft transition hover:bg-gold/25"
                            >
                              <UserPlus size={13} /> Convert
                            </button>
                          )}
                          <button
                            title="Edit"
                            onClick={() => setLeadModal({ open: true, lead: l })}
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            title="Delete"
                            disabled={!can("leads.delete")}
                            onClick={() => remove(l)}
                            className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 size={16} />
                          </button>
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

      {leadModal.open && (
        <LeadModal
          key={leadModal.lead?.id ?? "new"}
          lead={leadModal.lead}
          branches={activeBranches}
          defaultBranchId={
            branchId !== "all" && activeBranches.some((b) => b.id === branchId)
              ? branchId
              : (activeBranches[0]?.id ?? "")
          }
          onClose={() => setLeadModal({ open: false, lead: null })}
          onSave={handleSave}
        />
      )}

      {followLead && businessId && (
        <FollowUpModal
          key={followLead.id}
          businessId={businessId}
          lead={followLead}
          actorName={actor}
          onClose={() => setFollowLead(null)}
        />
      )}

      {convertLead && (
        <MemberModal
          key={convertLead.id}
          member={null}
          initial={{
            name: convertLead.name,
            phone: convertLead.phone,
            email: convertLead.email,
            goal: convertLead.interest,
            source: convertLead.source,
            notes: convertLead.notes,
            branchId: convertLead.branchId,
          }}
          branches={activeBranches}
          defaultBranchId={convertLead.branchId}
          onClose={() => setConvertLead(null)}
          onSave={handleConvert}
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

// Enquiry date of a lead as YYYY-MM-DD (a lead just created has no server time yet, so use today)
function dateOfLead(l: Lead, today: string) {
  return l.createdAt ? toStr(l.createdAt.toDate()) : today;
}
