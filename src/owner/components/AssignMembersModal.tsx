import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { Search, X } from "lucide-react";
import { db } from "../../firebase";
import type { Member, StaffMember } from "../../types";
import { memberStatus, statusMeta } from "../utils";


type Props = {
  businessId: string;
  trainer: StaffMember;
  members: Member[];
  onClose: () => void;
};

export default function AssignMembersModal({ businessId, trainer, members, onClose }: Props) {
  const live = members.filter((m) => !m.archived);

  const [selected, setSelected] = useState<Set<string>>(
    new Set(live.filter((m) => m.trainerId === trainer.id).map((m) => m.id))
  );
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const q = search.trim().toLowerCase();
  const shown = live.filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.code.toLowerCase().includes(q) ||
      m.phone.includes(q)
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    setError("");
    setBusy(true);
    try {
      // Only members whose assignment really changed
      const changes: { id: string; trainerId: string; trainerName: string }[] = [];
      live.forEach((m) => {
        const wasMine = m.trainerId === trainer.id;
        const nowMine = selected.has(m.id);
        if (nowMine && !wasMine) {
          changes.push({ id: m.id, trainerId: trainer.id, trainerName: trainer.name });
        } else if (!nowMine && wasMine) {
          changes.push({ id: m.id, trainerId: "", trainerName: "" });
        }
      });

      // A batch holds at most 500 writes, so send in chunks
      for (let i = 0; i < changes.length; i += 400) {
        const batch = writeBatch(db);
        changes.slice(i, i + 400).forEach((c) =>
          batch.update(doc(db, "businesses", businessId, "members", c.id), {
            trainerId: c.trainerId,
            trainerName: c.trainerName,
          })
        );
        await batch.commit();
      }
      onClose();
    } catch {
      setError("Could not save. Please check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="card relative my-8 w-full max-w-xl !bg-white p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Trainer</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Assign members to {trainer.name}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {selected.size} member{selected.size === 1 ? "" : "s"} selected. Selecting a member
          who already has another trainer moves them to {trainer.name}.
        </p>

        <div className="relative mt-5">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone or code..."
            className="input-lux !py-2.5 text-sm"
          />
        </div>

        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
          {shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No members found.</p>
          ) : (
            shown.map((m) => {
              const st = memberStatus(m);
              const other = m.trainerId && m.trainerId !== trainer.id ? m.trainerName : "";
              return (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white/60 p-3 transition hover:border-gold/40"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="h-4 w-4 accent-[#c9a227]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.name} <span className="text-xs font-normal text-muted">· {m.code}</span>
                    </p>
                    {other && <p className="text-xs text-amber-700">Currently with {other}</p>}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${statusMeta[st].cls}`}>
                    {statusMeta[st].label}
                  </span>
                </label>
              );
            })
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
          <button
            onClick={save}
            disabled={busy}
            className="btn-gold px-6 py-2.5 text-sm"
          >
            {busy ? "Saving..." : "Save Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}