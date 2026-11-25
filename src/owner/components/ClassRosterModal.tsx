import { useState } from "react";
import { FirebaseError } from "firebase/app";
import { Check, MessageCircle, Search, X, XCircle } from "lucide-react";
import type { ClassSession, GymClass, Member, MembershipPlan } from "../../types";
import { bookingBlock, fmtT, ROSTER_STATUS, sessionId } from "../classUtils";
import {
  bookMember,
  removeFromSession,
  setAttendance,
  setSessionCancelled,
} from "../classService";
import { waLink } from "../leadUtils";
import { fmtDate, todayStr } from "../utils";

type Props = {
  businessId: string;
  cls: GymClass;
  date: string;
  session: ClassSession | null; // live data from the page
  members: Member[];
  plans: MembershipPlan[];
  canBook: boolean;
  canAttend: boolean;
  canManage: boolean;
  onClose: () => void;
};



export default function ClassRosterModal({
  businessId,
  cls,
  date,
  session,
  members,
  plans,
  canBook,
  canAttend,
  canManage,
  onClose,
}: Props) {
  const today = todayStr();
  const sid = sessionId(cls.id, date);

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const roster = session?.roster ?? [];
  const waitlist = session?.waitlist ?? [];
  const ids = session?.memberIds ?? [];
  const cancelled = !!session?.cancelled;
  const isPast = date < today;
  const canAdd = canBook && !isPast && !cancelled;
  const canMark = canAttend && date <= today && !cancelled;
  const full = roster.length >= cls.capacity;

  const term = q.trim().toLowerCase();
  const candidates = term
    ? members
        .filter(
          (m) =>
            !m.archived &&
            !ids.includes(m.id) &&
            (m.name.toLowerCase().includes(term) ||
              m.phone.includes(term) ||
              m.code.toLowerCase().includes(term))
        )
        .slice(0, 5)
    : [];

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ ok: true, text: await fn() });
    } catch (err) {
      setNotice({
        ok: false,
        text:
          err instanceof Error && !(err instanceof FirebaseError)
            ? err.message
            : "Could not save. Please check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const book = (m: Member) =>
    run(async () => {
      const result = await bookMember(businessId, cls, date, m);
      setQ("");
      return result === "booked"
        ? `${m.name} is booked.`
        : `The class is full, so ${m.name} was added to the waitlist.`;
    });

  const remove = (memberId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this class?`)) return;
    return run(async () => {
      const promoted = await removeFromSession(businessId, sid, memberId);
      return promoted
        ? `${name} was removed. ${promoted} moved up from the waitlist.`
        : `${name} was removed.`;
    });
  };

  const mark = (memberId: string, status: "attended" | "no_show") =>
    run(async () => {
      await setAttendance(businessId, sid, memberId, status);
      return "Attendance updated.";
    });

  const toggleCancel = () => {
    const next = !cancelled;
    const text = next
      ? `Cancel "${cls.name}" on ${fmtDate(date)}? No new bookings will be accepted. Existing bookings stay on the sheet so you can inform the members.`
      : `Restore "${cls.name}" on ${fmtDate(date)}?`;
    if (!window.confirm(text)) return;
    return run(async () => {
      await setSessionCancelled(businessId, cls, date, next);
      return next ? "The class is cancelled for this date." : "The class is active again.";
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="card relative my-8 w-full max-w-2xl !bg-white p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Class Roster</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{cls.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {fmtDate(date)} · {fmtT(cls.startTime)} to {fmtT(cls.endTime)} · {cls.branchName}
          {cls.trainerName ? ` · ${cls.trainerName}` : ""}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gold/15 px-3 py-1 text-xs text-gold-soft">
            {roster.length} / {cls.capacity} booked
          </span>
          {waitlist.length > 0 && (
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-700">
              {waitlist.length} on waitlist
            </span>
          )}
          {cancelled && (
            <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-700">
              Cancelled for this date
            </span>
          )}
          {isPast && (
            <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs text-slate-600">
              Past class
            </span>
          )}
        </div>

        {notice && (
          <p
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              notice.ok
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                : "border-red-500/20 bg-red-500/10 text-red-700"
            }`}
          >
            {notice.text}
          </p>
        )}

        {/* Add a member */}
        {canAdd && (
          <div className="mt-6">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={
                  full
                    ? "Class is full. Search to add to the waitlist..."
                    : "Search a member by name, phone or code to book..."
                }
                className="input-lux !py-2.5 text-sm"
              />
            </div>

            {term && candidates.length === 0 && (
              <p className="mt-3 text-sm text-muted">No matching member found.</p>
            )}

            {candidates.length > 0 && (
              <div className="mt-3 space-y-2">
                {candidates.map((m) => {
                  const block = bookingBlock(m, cls, date, plans);
                  return (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white/60 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.name}{" "}
                          <span className="text-xs font-normal text-muted">· {m.code}</span>
                        </p>
                        <p className={`text-xs ${block ? "text-red-600" : "text-muted"}`}>
                          {block ??
                            `${m.membershipPlan} until ${fmtDate(m.membershipEnd)}`}
                        </p>
                      </div>
                      <button
                        disabled={busy || !!block}
                        onClick={() => book(m)}
                        className="btn-gold px-4 py-2 text-sm disabled:cursor-not-allowed"
                      >
                        {full ? "Add to waitlist" : "Book"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Roster */}
        <h3 className="mt-8 font-display text-lg">Booked members</h3>
        {roster.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nobody has booked this class yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {roster.map((r) => {
              const st = ROSTER_STATUS[r.status];
              return (
                <div
                  key={r.memberId}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {r.name}{" "}
                      <span className="text-xs font-normal text-muted">· {r.code}</span>
                    </p>
                    <p className="text-xs text-muted">{r.phone}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${st.cls}`}>{st.label}</span>

                  {canMark && (
                    <>
                      <button
                        title="Mark present"
                        disabled={busy}
                        onClick={() => mark(r.memberId, "attended")}
                        className={`rounded-lg p-2 transition hover:bg-emerald-500/10 hover:text-emerald-700 ${
                          r.status === "attended" ? "text-emerald-700" : "text-muted"
                        }`}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        title="Mark no-show"
                        disabled={busy}
                        onClick={() => mark(r.memberId, "no_show")}
                        className={`rounded-lg p-2 transition hover:bg-red-500/10 hover:text-red-600 ${
                          r.status === "no_show" ? "text-red-600" : "text-muted"
                        }`}
                      >
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                  {cancelled && canBook && (
                    <a
                      title="WhatsApp"
                      href={waLink(r.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-muted transition hover:bg-emerald-500/10 hover:text-emerald-700"
                    >
                      <MessageCircle size={16} />
                    </a>
                  )}
                  {canBook && !isPast && (
                    <button
                      title="Remove"
                      disabled={busy}
                      onClick={() => remove(r.memberId, r.name)}
                      className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Waitlist */}
        {waitlist.length > 0 && (
          <>
            <h3 className="mt-8 font-display text-lg">Waitlist</h3>
            <p className="text-xs text-muted">
              The first person is moved into the class automatically when a seat opens.
            </p>
            <div className="mt-3 space-y-2">
              {waitlist.map((w, i) => (
                <div
                  key={w.memberId}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white/60 p-3"
                >
                  <span className="w-5 text-sm text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {w.name}{" "}
                      <span className="text-xs font-normal text-muted">· {w.code}</span>
                    </p>
                    <p className="text-xs text-muted">{w.phone}</p>
                  </div>
                  {canBook && !isPast && (
                    <button
                      title="Remove"
                      disabled={busy}
                      onClick={() => remove(w.memberId, w.name)}
                      className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-line pt-5">
          {canManage && !isPast ? (
            <button
              disabled={busy}
              onClick={toggleCancel}
              className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:border-red-400 hover:text-red-600"
            >
              {cancelled ? "Restore this class" : "Cancel this class for today"}
            </button>
          ) : (
            <span />
          )}
          <button onClick={onClose} className="btn-gold px-6 py-2.5 text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}