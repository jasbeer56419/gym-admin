import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { AlertTriangle, CheckCircle2, Clock, UserX, Users } from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import type { Member, StaffMember } from "../../types";
import { useOwner } from "../OwnerContext";
import {
  daysBetween,
  expiryText,
  fmtDate,
  memberStatus,
  statusMeta,
  todayStr,
} from "../utils";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const fmtT = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export default function TrainerHome() {
  const { user, profile } = useAuth();
  const { businessId, business } = useOwner();

  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<StaffMember | null>(null);

  useEffect(() => {
    if (!businessId || !user) return;
    const u1 = onSnapshot(collection(db, "businesses", businessId, "members"), (snap) =>
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Member))
    );
    const u2 = onSnapshot(doc(db, "businesses", businessId, "staff", user.uid), (snap) =>
      setMe(snap.exists() ? ({ id: snap.id, ...snap.data() } as StaffMember) : null)
    );
    return () => {
      u1();
      u2();
    };
  }, [businessId, user]);

  const mine = useMemo(
    () => members.filter((m) => m.trainerId === user?.uid && !m.archived),
    [members, user]
  );

  const stats = useMemo(() => {
    const today = todayStr();
    const st = mine.map(memberStatus);
    return {
      total: mine.length,
      active: st.filter((s) => s === "active" || s === "expiring").length,
      expiring: st.filter((s) => s === "expiring").length,
      away: mine.filter(
        (m) =>
          ["active", "expiring"].includes(memberStatus(m)) &&
          daysBetween(m.lastVisit || m.membershipStart || today, today) >= 14
      ).length,
    };
  }, [mine]);

  const firstName = profile?.name.split(" ")[0] || "there";

  const cards = [
    { label: "My Members", value: stats.total, sub: "Assigned to you", icon: Users },
    { label: "Active", value: stats.active, sub: "With a valid membership", icon: CheckCircle2 },
    { label: "Expiring in 7 Days", value: stats.expiring, sub: "Remind them to renew", icon: Clock },
    { label: "Not Seen Lately", value: stats.away, sub: "No visit for 14+ days", icon: UserX },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">{business?.name}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          {greeting()}, <span className="gold-text">{firstName}</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          {me?.shift?.days?.length
            ? `Your shift: ${me.shift.days.join(", ")} · ${fmtT(me.shift.start)} – ${fmtT(me.shift.end)}`
            : "Here are the members assigned to you."}
        </p>
      </div>

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
              <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>{sub}</p>
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="font-display text-xl">My Members</h3>
          <p className="text-sm text-muted">Members assigned to you by the gym owner</p>
        </div>

        {mine.length === 0 ? (
          <div className="grid place-items-center px-6 pb-12 pt-4 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
              <AlertTriangle size={22} />
            </div>
            <p className="mt-4 font-display text-xl">No members assigned yet</p>
            <p className="mt-1 text-sm text-muted">
              The gym owner will assign members to you from the Staff page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-y border-line text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-3 font-medium">Member</th>
                  <th className="px-6 py-3 font-medium">Membership</th>
                  <th className="px-6 py-3 font-medium">Expires</th>
                  <th className="px-6 py-3 font-medium">Last visit</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((m) => {
                  const st = memberStatus(m);
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-line/60 transition last:border-0 hover:bg-gold/5"
                    >
                      <td className="px-6 py-3">
                        <Link to={`/app/members/${m.id}`} className="font-medium hover:underline">
                          {m.name}
                        </Link>
                        <p className="text-xs text-muted">
                          {m.code} · {m.goal || "No goal set"}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-muted">{m.membershipPlan || "—"}</td>
                      <td className="px-6 py-3">
                        {m.membershipEnd ? (
                          <>
                            <p>{fmtDate(m.membershipEnd)}</p>
                            <p className="text-xs text-muted">{expiryText(m.membershipEnd)}</p>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-6 py-3 text-muted">
                        {m.lastVisit ? fmtDate(m.lastVisit) : "Never"}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs ${statusMeta[st].cls}`}>
                          {statusMeta[st].label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}