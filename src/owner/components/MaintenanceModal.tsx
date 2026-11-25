import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Equipment, EquipmentLog, EquipmentLogType } from "../inventoryTypes";
import { logMaintenance } from "../inventoryService";
import { fmtDate, rupee, todayStr } from "../utils";

const TYPES: { value: EquipmentLogType; label: string; help: string }[] = [
  {
    value: "service",
    label: "Regular service done",
    help: "The machine is marked Working and the next service date is set.",
  },
  {
    value: "repair",
    label: "Repair done",
    help: "The machine is marked Working and the next service date is set.",
  },
  {
    value: "issue",
    label: "Report a problem",
    help: "The machine is marked Out of order until a service or repair is logged.",
  },
];

const LOG_STYLE: Record<EquipmentLogType, { label: string; cls: string }> = {
  service: { label: "Service", cls: "bg-emerald-500/10 text-emerald-700" },
  repair: { label: "Repair", cls: "bg-sky-500/10 text-sky-700" },
  issue: { label: "Problem", cls: "bg-red-500/10 text-red-700" },
};

type Props = {
  businessId: string;
  item: Equipment;
  logs: EquipmentLog[]; // logs of this machine only, newest first
  by: string;
  onClose: () => void;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function MaintenanceModal({ businessId, item, logs, by, onClose }: Props) {
  const [type, setType] = useState<EquipmentLogType>("service");
  const [date, setDate] = useState(todayStr());
  const [cost, setCost] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const info = TYPES.find((t) => t.value === type);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (cost < 0) {
      setError("The cost cannot be negative.");
      return;
    }

    setBusy(true);
    try {
      await logMaintenance(businessId, item, {
        type,
        date,
        cost: type === "issue" ? 0 : cost,
        notes: notes.trim(),
        by,
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
        className="card relative my-8 w-full max-w-2xl !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Maintenance</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{item.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {item.branchName}
          {item.lastServiceDate ? ` · last service ${fmtDate(item.lastServiceDate)}` : ""}
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>What happened?</label>
            <select
              className={field}
              value={type}
              onChange={(e) => setType(e.target.value as EquipmentLogType)}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {info && <p className="mt-1.5 text-xs text-muted">{info.help}</p>}
          </div>

          <div>
            <label className={label}>Date</label>
            <input
              type="date"
              className={field}
              max={todayStr()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {type !== "issue" && (
            <div>
              <label className={label}>Cost (₹)</label>
              <input
                type="number"
                min={0}
                className={field}
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className={label}>Notes</label>
            <input
              className={field}
              placeholder={
                type === "issue" ? "e.g. Belt is slipping" : "e.g. Belt replaced by vendor"
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
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
            Close
          </button>
          <button type="submit" disabled={busy} className="btn-gold px-6 py-2.5 text-sm">
            {busy ? "Saving..." : "Save Log"}
          </button>
        </div>

        {/* History */}
        <div className="mt-8 border-t border-line pt-5">
          <h3 className="font-display text-lg">Maintenance History</h3>
          {logs.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing logged for this machine yet.</p>
          ) : (
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {logs.map((l) => (
                <div key={l.id} className="rounded-lg border border-line bg-white/60 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs ${LOG_STYLE[l.type].cls}`}>
                      {LOG_STYLE[l.type].label}
                    </span>
                    <span className="text-xs text-muted">
                      {fmtDate(l.date)} · {l.by}
                      {l.cost > 0 ? ` · ${rupee(l.cost)}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-muted">{l.notes}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}