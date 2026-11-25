import { useState, type FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { X } from "lucide-react";
import { db } from "../../firebase";
import type { PtClient, PtSession } from "../ptTypes";
import { fmtT } from "../classUtils";
import { fmtDate, todayStr } from "../utils";

type Props = {
  businessId: string;
  client: PtClient;
  sessions: PtSession[]; // all loaded sessions, used for the clash check
  onClose: () => void;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function PtSessionModal({ businessId, client, sessions, onClose }: Props) {
  const today = todayStr();

  const [date, setDate] = useState(client.startDate > today ? client.startDate : today);
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("08:00");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const scheduled = sessions.filter((s) => s.ptId === client.id && s.status === "scheduled").length;
  const left = client.totalSessions - client.usedSessions - scheduled;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (left <= 0) {
      setError("All sessions of this package are already used or scheduled.");
      return;
    }
    if (date < today) {
      setError("You cannot schedule a session in the past.");
      return;
    }
    if (date < client.startDate || date > client.expiryDate) {
      setError(
        `The date must be within the package validity (${fmtDate(client.startDate)} to ${fmtDate(
          client.expiryDate
        )}).`
      );
      return;
    }
    if (endTime <= startTime) {
      setError("The end time must be after the start time.");
      return;
    }

    const clash = sessions.find(
      (s) =>
        s.trainerId === client.trainerId &&
        s.date === date &&
        s.status === "scheduled" &&
        s.startTime < endTime &&
        startTime < s.endTime
    );
    if (clash) {
      setError(
        `${client.trainerName} already has a session with ${clash.memberName} from ${fmtT(
          clash.startTime
        )} to ${fmtT(clash.endTime)}.`
      );
      return;
    }

    setBusy(true);
    try {
      await addDoc(collection(db, "businesses", businessId, "ptSessions"), {
        ptId: client.id,
        memberId: client.memberId,
        memberName: client.memberName,
        trainerId: client.trainerId,
        trainerName: client.trainerName,
        branchId: client.branchId,
        date,
        startTime,
        endTime,
        status: "scheduled",
        notes: notes.trim(),
        createdAt: serverTimestamp(),
      });
      onClose();
    } catch {
      setError("Could not save. Please check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="card relative my-8 w-full max-w-lg !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Personal Training</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Schedule a Session</h2>
        <p className="mt-1 text-sm text-muted">
          {client.memberName} · {client.packageName} · with {client.trainerName}
        </p>

        <div className="mt-5 rounded-xl bg-black/[0.03] p-4 text-sm">
          <p>
            <b>{left}</b> session{left === 1 ? "" : "s"} left to schedule ({client.usedSessions}{" "}
            done, {scheduled} scheduled, {client.totalSessions} total).
          </p>
          <p className="text-muted">Valid until {fmtDate(client.expiryDate)}.</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Date</label>
            <input
              type="date"
              className={field}
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Starts</label>
            <input
              type="time"
              className={field}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Ends</label>
            <input
              type="time"
              className={field}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className={label}>Focus / Notes (optional)</label>
            <input
              className={field}
              placeholder="e.g. Upper body strength"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
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
          <button
            type="submit"
            disabled={busy || left <= 0}
            className="btn-gold px-6 py-2.5 text-sm disabled:cursor-not-allowed"
          >
            {busy ? "Saving..." : "Schedule Session"}
          </button>
        </div>
      </form>
    </div>
  );
}