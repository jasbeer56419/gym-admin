import { useState, type FormEvent } from "react";
import { arrayUnion, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { X } from "lucide-react";
import { db } from "../../firebase";
import type { Lead, LeadActivity, LeadStatus } from "../../types";
import { LEAD_STATUS, isOpen } from "../leadUtils";
import { addDays, fmtDate, todayStr } from "../utils";

type Props = {
  businessId: string;
  lead: Lead;
  actorName: string;
  onClose: () => void;
};

const TYPES = ["Call", "WhatsApp", "Visit", "Trial session", "Other"];
const STATUS_OPTIONS: LeadStatus[] = ["new", "contacted", "trial", "negotiation", "lost"];

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export default function FollowUpModal({ businessId, lead, actorName, onClose }: Props) {
  const today = todayStr();
  const [type, setType] = useState("Call");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<LeadStatus>(
    isOpen(lead.status) ? (lead.status === "new" ? "contacted" : lead.status) : "contacted"
  );
  const [nextDate, setNextDate] = useState(addDays(today, 2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (status === "lost" && !reason.trim()) {
      setError("Please enter the reason this lead was lost.");
      return;
    }

    setBusy(true);
    try {
      const entry: LeadActivity = {
        at: new Date().toISOString(),
        type,
        note: note.trim() + (status === "lost" ? ` (Lost: ${reason.trim()})` : ""),
        by: actorName,
      };
      await updateDoc(doc(db, "businesses", businessId, "leads", lead.id), {
        status,
        nextFollowUp: status === "lost" ? "" : nextDate,
        lastContact: today,
        lostReason: status === "lost" ? reason.trim() : "",
        activity: arrayUnion(entry),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch {
      setError("Could not save. Please check your connection and try again.");
      setBusy(false);
    }
  };

  const history = [...(lead.activity ?? [])].reverse();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="card relative my-8 w-full max-w-2xl !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Follow-up</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{lead.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {lead.phone} · {lead.interest} · {LEAD_STATUS[lead.status].label}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>How did you reach out?</label>
            <select className={field} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Update Status</label>
            <select
              className={field}
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS[s].label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={label}>What happened?</label>
            <textarea
              rows={3}
              required
              className={`${field} resize-none`}
              placeholder="e.g. Asked about the quarterly plan, will visit on Saturday"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {status === "lost" ? (
            <div className="sm:col-span-2">
              <label className={label}>Reason lost</label>
              <input
                className={field}
                placeholder="e.g. Too expensive, joined another gym"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          ) : (
            <div className="sm:col-span-2">
              <label className={label}>Next Follow-up</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className={`${field} !w-auto`}
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                />
                {[
                  { t: "Tomorrow", n: 1 },
                  { t: "In 3 days", n: 3 },
                  { t: "In a week", n: 7 },
                ].map((q) => (
                  <button
                    key={q.t}
                    type="button"
                    onClick={() => setNextDate(addDays(today, q.n))}
                    className="rounded-full border border-line px-3.5 py-1.5 text-xs text-muted transition hover:text-charcoal"
                  >
                    {q.t}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setNextDate("")}
                  className="rounded-full border border-line px-3.5 py-1.5 text-xs text-muted transition hover:text-charcoal"
                >
                  No date
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:text-charcoal"
          >
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-gold px-6 py-2.5 text-sm">
            {busy ? "Saving..." : "Save Follow-up"}
          </button>
        </div>

        {/* History */}
        <div className="mt-8 border-t border-line pt-5">
          <h3 className="font-display text-lg">History</h3>
          {lead.notes && (
            <p className="mt-2 rounded-lg bg-black/[0.03] px-3 py-2 text-sm text-muted">
              Note: {lead.notes}
            </p>
          )}
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No activity yet.</p>
          ) : (
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {history.map((a, i) => (
                <div key={i} className="rounded-lg border border-line bg-white/60 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{a.type}</span>
                    <span className="text-xs text-muted">
                      {when(a.at)} · {a.by}
                    </span>
                  </div>
                  <p className="mt-0.5 text-muted">{a.note}</p>
                </div>
              ))}
            </div>
          )}
          {lead.createdAt && (
            <p className="mt-3 text-xs text-muted">
              Lead created on {fmtDate(lead.createdAt.toDate().toISOString().slice(0, 10))}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}