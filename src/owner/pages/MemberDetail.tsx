import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usePermissions } from "../permissions";
import CollectedBy from "../components/CollectedBy";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  Snowflake,
  Target,
    FileText,
  Wallet,
  Trash2,
  
  TrendingUp,
  User,
  UserPlus,
    QrCode,
} from "lucide-react";
import { db } from "../../firebase";
import type {
   AttendanceRecord,
  Member,
  MemberInput,
  MemberPayment,
  Membership,
  MembershipPlan,
} from "../../types";
import { useOwner } from "../OwnerContext";
import {
  addDays,
  daysBetween,
  expiryText,
  fmtDate,
    fmtTime,
  memberStatus,
  parseDate,
  rupee,
  statusMeta,
  todayStr,
} from "../utils";
import MemberModal from "../components/MemberModal";
import { useSettings } from "../useSettings";
import CollectPaymentModal from "../components/CollectPaymentModal";
import ReceiptModal from "../components/ReceiptModal";
import AssignMembershipModal, { type AssignMode } from "../components/AssignMembershipModal";
import MemberCardModal from "../components/MemberCardModal";

const ageOf = (dob: string) => {
  const d = parseDate(dob);
  const t = new Date();
  let age = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
  return age;
};

export default function MemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
const { businessId, branches, business } = useOwner();
  const { can } = usePermissions();
  const canWrite = can("members.write");

  const [member, setMember] = useState<Member | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [payments, setPayments] = useState<MemberPayment[]>([]);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loaded, setLoaded] = useState({ member: false, memberships: false, payments: false });
  const [editOpen, setEditOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<AssignMode | null>(null);
    const settings = useSettings(businessId);
  const [collectOpen, setCollectOpen] = useState(false);
  const [receipt, setReceipt] = useState<MemberPayment | null>(null);
    const [visits, setVisits] = useState<AttendanceRecord[]>([]);
  const [cardOpen, setCardOpen] = useState(false);

  useEffect(() => {
    if (!businessId || !id) return;
    return onSnapshot(
      query(collection(db, "businesses", businessId, "attendance"), where("memberId", "==", id)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AttendanceRecord);
        list.sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (b.checkInAt?.seconds ?? 9e12) - (a.checkInAt?.seconds ?? 9e12)
        );
        setVisits(list);
      },
      () => {
        /* visits are optional, ignore errors */
      }
    );
  }, [businessId, id]);

  useEffect(() => {
    if (!businessId || !id) return;
    const mark = (k: "member" | "memberships" | "payments") =>
      setLoaded((l) => ({ ...l, [k]: true }));

    const u1 = onSnapshot(
      doc(db, "businesses", businessId, "members", id),
      (snap) => {
        setMember(snap.exists() ? ({ id: snap.id, ...snap.data() } as Member) : null);
        mark("member");
      },
      () => mark("member")
    );

    const u2 = onSnapshot(
      query(collection(db, "businesses", businessId, "memberships"), where("memberId", "==", id)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Membership);
        list.sort((a, b) => b.startDate.localeCompare(a.startDate));
        setMemberships(list);
        mark("memberships");
      },
      () => mark("memberships")
    );

    const u3 = onSnapshot(
      query(collection(db, "businesses", businessId, "payments"), where("memberId", "==", id)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MemberPayment);
        list.sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
        );
        setPayments(list);
        mark("payments");
      },
      () => mark("payments")
    );

    const u4 = onSnapshot(
      collection(db, "businesses", businessId, "membershipPlans"),
      (snap) => setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MembershipPlan))
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [businessId, id]);

  if (!loaded.member || !loaded.memberships || !loaded.payments) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  if (!member || !businessId) {
    return (
      <div className="card grid place-items-center p-16 text-center">
        <p className="font-display text-xl">Member not found</p>
        <Link to="/app/members" className="btn-gold mt-5 px-5 py-2 text-sm">
          Back to members
        </Link>
      </div>
    );
  }

  const status = memberStatus(member);
  const current = memberships.find((x) => x.id === member.membershipId) ?? null;
  const today = todayStr();
  const memberRef = doc(db, "businesses", businessId, "members", member.id);

  const dueAmount = current ? Math.max(0, current.total - current.paid) : 0;

  let progress = 0;
  if (current) {
    const totalDays = daysBetween(current.startDate, current.endDate) + 1;
    const elapsed = daysBetween(current.startDate, today) + 1;
    progress = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  }

  const handleEdit = async (data: MemberInput) => {
    const branch = branches.find((b) => b.id === data.branchId);
    await updateDoc(memberRef, {
      ...data,
      branchName: branch?.name ?? member.branchName,
      updatedAt: serverTimestamp(),
    });
  };

  const freeze = async () => {
    if (!current) return;
    const left = current.maxFreezeDays - current.freezeDaysUsed;
    if (left <= 0) {
      window.alert("This plan does not allow freezing, or all freeze days have been used.");
      return;
    }
    if (
      window.confirm(
        `Freeze this membership? You can freeze up to ${left} more day(s) on this plan. The end date moves forward by the days frozen once you unfreeze.`
      )
    ) {
      await updateDoc(memberRef, { frozen: true, frozenOn: today });
    }
  };

  const unfreeze = async () => {
    if (!current) return;
    const used = Math.max(0, daysBetween(member.frozenOn, today));
    const allowed = Math.max(0, current.maxFreezeDays - current.freezeDaysUsed);
    const extend = Math.min(used, allowed);
    const newEnd = addDays(member.membershipEnd, extend);

    if (
      !window.confirm(
        `Frozen for ${used} day(s). ${extend} day(s) will be added to the membership, so the new end date is ${fmtDate(newEnd)}.` +
          (used > extend ? ` (The plan allows only ${allowed} more freeze day(s).)` : "")
      )
    ) {
      return;
    }

    const batch = writeBatch(db);
    batch.update(memberRef, { frozen: false, frozenOn: "", membershipEnd: newEnd });
    batch.update(doc(db, "businesses", businessId, "memberships", current.id), {
      endDate: newEnd,
      freezeDaysUsed: current.freezeDaysUsed + extend,
    });
    await batch.commit();
  };

  const toggleArchive = async () => {
    if (
      !member.archived &&
      !window.confirm(`Archive ${member.name}? They will be hidden from the main members list.`)
    ) {
      return;
    }
    await updateDoc(memberRef, { archived: !member.archived });
  };

  const remove = async () => {
    if (payments.length > 0) {
      window.alert(
        "This member has payment records, so they cannot be deleted. Archive them instead."
      );
      return;
    }
    if (!window.confirm(`Delete ${member.name} permanently? This cannot be undone.`)) return;

    const batch = writeBatch(db);
    memberships.forEach((ms) =>
      batch.delete(doc(db, "businesses", businessId, "memberships", ms.id))
    );
    batch.delete(memberRef);
    await batch.commit();
    navigate("/app/members");
  };

  const info: { icon: typeof Phone; label: string; value: string }[] = [
    { icon: Phone, label: "Phone", value: member.phone },
    { icon: Mail, label: "Email", value: member.email },
    {
      icon: User,
      label: "Gender / Age",
      value: [
        member.gender ? member.gender[0].toUpperCase() + member.gender.slice(1) : "",
        member.dob ? `${ageOf(member.dob)} years` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    },
    { icon: MapPin, label: "Address", value: member.address },
   
        { icon: Target, label: "Goal", value: member.goal },
    { icon: User, label: "Trainer", value: member.trainerName ?? "" },
    { icon: TrendingUp, label: "Found us via", value: member.source },
    {
      icon: Phone,
      label: "Emergency contact",
      value: [member.emergencyName, member.emergencyPhone].filter(Boolean).join(" · "),
    },
  ];

  const btn =
    "flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm transition hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-8">
      <Link
        to="/app/members"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-charcoal"
      >
        <ArrowLeft size={16} /> Back to members
      </Link>

      {/* Header */}
      <div className="card flex flex-wrap items-center justify-between gap-5 p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-display text-2xl font-semibold text-charcoal shadow-md shadow-gold/30">
            {member.name[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">{member.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {member.code} · {member.branchName || "No branch"} · Joined{" "}
              {member.createdAt
                ? fmtDate(
                    member.createdAt.toDate().toISOString().slice(0, 10)
                  )
                : "—"}
            </p>
            <span
              className={`mt-2 inline-block rounded-full px-3 py-1 text-xs ${statusMeta[status].cls}`}
            >
              {statusMeta[status].label}
            </span>
          </div>
        </div>

        
        <div className={`flex flex-wrap gap-2 ${canWrite ? "" : "hidden"}`}>
          {!member.membershipId ? (
            <button onClick={() => setAssignMode("new")} className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm">
              <UserPlus size={16} /> Assign Membership
            </button>
          ) : (
            <>
              <button
                onClick={() => setAssignMode("renew")}
                disabled={member.frozen}
                className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm disabled:cursor-not-allowed"
              >
                <RefreshCw size={16} /> Renew
              </button>
              <button
                onClick={() => setAssignMode("upgrade")}
                disabled={member.frozen}
                className={btn}
              >
                <TrendingUp size={16} /> Upgrade
              </button>
              {member.frozen ? (
                <button onClick={unfreeze} className={btn}>
                  <Snowflake size={16} /> Unfreeze
                </button>
              ) : (
                <button onClick={freeze} className={btn}>
                  <Snowflake size={16} /> Freeze
                </button>
              )}
            </>
          )}

          <button onClick={() => setCardOpen(true)} className={btn}>
            <QrCode size={16} /> ID Card
          </button>

          <button onClick={() => setEditOpen(true)} className={btn}>
            <Pencil size={16} /> Edit
          </button>
          <button onClick={toggleArchive} className={btn}>
            {member.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
            {member.archived ? "Restore" : "Archive"}
          </button>
          <button
            onClick={remove}
            className={`${btn} hover:!border-red-400 hover:text-red-600`}
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {/* Current membership */}
          <div className="card p-6">
            <h3 className="font-display text-xl">Current Membership</h3>

            {!current ? (
              <p className="mt-4 text-sm text-muted">
                This member does not have a membership yet. Click "Assign Membership" above.
              </p>
            ) : (
              <div className="mt-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="font-display text-2xl font-semibold">{current.planName}</p>
                    <p className="text-sm text-muted">
                      {fmtDate(current.startDate)} to {fmtDate(member.membershipEnd)}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {member.frozen
                      ? `Frozen since ${fmtDate(member.frozenOn)}`
                      : expiryText(member.membershipEnd)}
                  </p>
                </div>

                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gold/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-light to-gold transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-white/60 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted">Total</p>
                    <p className="mt-1 font-display text-xl font-semibold">
                      {rupee(current.total)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-white/60 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted">Paid</p>
                    <p className="mt-1 font-display text-xl font-semibold text-emerald-700">
                      {rupee(current.paid)}
                    </p>
                  </div>
                  <div
                    className={`rounded-xl border p-4 ${
                      dueAmount > 0
                        ? "border-red-300 bg-red-500/5"
                        : "border-line bg-white/60"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-wider text-muted">Balance due</p>
                    <p
                      className={`mt-1 font-display text-xl font-semibold ${
                        dueAmount > 0 ? "text-red-600" : ""
                      }`}
                    >
                      {rupee(dueAmount)}
                    </p>
                  </div>
                </div>

              
                            
                            {canWrite && dueAmount > 0 && (
                  <button
                    onClick={() => setCollectOpen(true)}
                    className="btn-gold mt-4 flex items-center gap-2 px-5 py-2.5 text-sm"
                  >
                    <Wallet size={16} /> Collect {rupee(dueAmount)}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* History */}
          <div className="card overflow-hidden">
            <div className="p-6 pb-3">
              <h3 className="font-display text-xl">Membership History</h3>
            </div>
            {memberships.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">No memberships yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                      <th className="px-6 py-3 font-medium">Plan</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">Period</th>
                      <th className="px-6 py-3 font-medium">Total</th>
                      <th className="px-6 py-3 font-medium">Paid</th>
                         <th className="px-6 py-3 font-medium">Sold by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberships.map((ms) => (
                      <tr key={ms.id} className="border-b border-line/60 last:border-0">
                        <td className="px-6 py-3 font-medium">
                          {ms.planName}
                          {ms.status === "replaced" && (
                            <span className="ml-2 text-xs text-muted">(replaced)</span>
                          )}
                        </td>
                        <td className="px-6 py-3 capitalize text-muted">{ms.type}</td>
                        <td className="px-6 py-3 text-muted">
                          {fmtDate(ms.startDate)} to {fmtDate(ms.endDate)}
                        </td>
                        <td className="px-6 py-3">{rupee(ms.total)}</td>
                        <td className="px-6 py-3">{rupee(ms.paid)}</td>
                           <td className="px-6 py-3"><CollectedBy name={ms.soldByName} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="card overflow-hidden">
            <div className="p-6 pb-3">
              <h3 className="font-display text-xl">Payments</h3>
            </div>
            {payments.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">No payments recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                      <th className="px-6 py-3 font-medium">Invoice</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Plan</th>
                      <th className="px-6 py-3 font-medium">Method</th>
                         <th className="px-6 py-3 font-medium">Collected by</th>
                      <th className="px-6 py-3 font-medium">Amount</th>
                                            <th className="px-6 py-3 font-medium">Receipt</th>
                                            
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-line/60 last:border-0">
                        <td className="px-6 py-3 font-medium">{p.invoiceNo}</td>
                        <td className="px-6 py-3 text-muted">{fmtDate(p.date)}</td>
                        <td className="px-6 py-3 text-muted">{p.planName}</td>
                        <td className="px-6 py-3 text-muted">{p.method}</td>
                           <td className="px-6 py-3">
     <CollectedBy name={p.collectedByName} role={p.collectedByRole} />
   </td>
                                               <td className="px-6 py-3 font-medium">
                          {rupee(p.amount)}
                          {(p.refundedAmount ?? 0) > 0 && (
                            <p className="text-xs font-normal text-red-600">
                              - {rupee(p.refundedAmount ?? 0)} refunded
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <button
                            title="View receipt"
                            onClick={() => setReceipt(p)}
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            <FileText size={16} />
                          </button>
                        </td>
                       
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Profile */}
        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="font-display text-xl">Profile</h3>
            <div className="mt-5 space-y-4">
              {info.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold/10 text-gold-soft">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
                    <p className="break-words text-sm">{value || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-xl">Attendance</h3>

            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-line bg-white/60 p-3">
                <p className="font-display text-2xl font-semibold">
                  {visits.filter((v) => v.date.startsWith(today.slice(0, 7))).length}
                </p>
                <p className="text-xs text-muted">This month</p>
              </div>
              <div className="rounded-xl border border-line bg-white/60 p-3">
                <p className="font-display text-2xl font-semibold">
                  {member.visitCount ?? visits.length}
                </p>
                <p className="text-xs text-muted">Total visits</p>
              </div>
              <div className="rounded-xl border border-line bg-white/60 p-3">
                <p className="text-sm font-semibold">
                  {member.lastVisit ? fmtDate(member.lastVisit) : "—"}
                </p>
                <p className="text-xs text-muted">Last visit</p>
              </div>
            </div>

            {visits.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No visits recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {visits.slice(0, 6).map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-2 text-sm"
                  >
                    <span>{fmtDate(v.date)}</span>
                    <span className="text-muted">
                      {fmtTime(v.checkInAt)}
                      {v.checkOutAt ? ` to ${fmtTime(v.checkOutAt)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {member.notes && (
            <div className="card p-6">
              <h3 className="font-display text-xl">Notes</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{member.notes}</p>
            </div>
          )}
        </div>
      </div>

      {editOpen && (
        <MemberModal
          member={member}
          branches={branches.filter((b) => b.status === "active" || b.id === member.branchId)}
          defaultBranchId={member.branchId}
          onClose={() => setEditOpen(false)}
          onSave={handleEdit}
        />
      )}

      {assignMode && (
        <AssignMembershipModal
          key={assignMode}
          businessId={businessId}
          member={member}
          mode={assignMode}
          plans={plans}
          onClose={() => setAssignMode(null)}
        />
      )}

      {cardOpen && (
        <MemberCardModal
          member={member}
          businessName={business?.name ?? ""}
          onClose={() => setCardOpen(false)}
        />
      )}

      {collectOpen && current && (
        <CollectPaymentModal
          businessId={businessId}
          membership={current}
          onClose={() => setCollectOpen(false)}
        />
      )}

      {receipt && (
        <ReceiptModal
          payment={receipt}
          settings={settings}
          businessName={business?.name ?? ""}
          onClose={() => setReceipt(null)}
        />
      )}

    </div>
  );
}