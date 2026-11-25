import { useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Clock,
  GitBranch,
  Mail,
  MapPin,
  PauseCircle,
  Pencil,
  Phone,
  PlayCircle,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { db } from "../../firebase";
import type { Branch, BranchInput } from "../../types";
import { useOwner } from "../OwnerContext";
import BranchModal from "../components/BranchModal";

const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export default function Branches() {
  const { businessId, plan, branches } = useOwner();
  const [modal, setModal] = useState<{ open: boolean; branch: Branch | null }>({
    open: false,
    branch: null,
  });

  // If the plan cannot be found, allow only 1 branch to stay safe
  const max = plan ? plan.maxBranches : 1;
  const atLimit = max !== 0 && branches.length >= max;

  const handleSave = async (data: BranchInput) => {
    if (!businessId) return;

    if (modal.branch) {
      await updateDoc(doc(db, "businesses", businessId, "branches", modal.branch.id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (atLimit) {
      throw new Error("You have reached the branch limit of your plan.");
    }
    await addDoc(collection(db, "businesses", businessId, "branches"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  };

  const toggleStatus = async (b: Branch) => {
    if (!businessId) return;
    await updateDoc(doc(db, "businesses", businessId, "branches", b.id), {
      status: b.status === "active" ? "inactive" : "active",
    });
  };

  const remove = async (b: Branch) => {
    if (!businessId) return;
    if (
      window.confirm(
        `Delete the "${b.name}" branch? This cannot be undone. If you only want to hide it, deactivate it instead.`
      )
    ) {
      await deleteDoc(doc(db, "businesses", businessId, "branches", b.id));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Setup</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Your <span className="gold-text">Branches</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Manage every gym location: address, timings, manager and facilities.
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, branch: null })}
          disabled={atLimit}
          title={atLimit ? "Branch limit reached" : "Add a branch"}
          className="btn-gold flex items-center gap-2 px-5 py-3 text-sm disabled:cursor-not-allowed"
        >
          <Plus size={18} /> Add Branch
        </button>
      </div>

      {/* Plan usage banner */}
      <div
        className={`card flex flex-wrap items-center justify-between gap-3 p-5 ${
          atLimit ? "!border-gold/50" : ""
        }`}
      >
        <p className="text-sm">
          <b>{branches.length}</b> of <b>{max === 0 ? "unlimited" : max}</b> branches used on
          your <b>{plan?.name ?? "current"}</b> plan.
        </p>
        {atLimit && (
          <p className="text-sm text-gold-soft">
            Limit reached. Contact the platform administrator to upgrade your plan.
          </p>
        )}
      </div>

      {branches.length === 0 ? (
        <div className="card grid place-items-center p-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
            <GitBranch size={24} />
          </div>
          <p className="mt-4 font-display text-xl">No branches yet</p>
          <p className="mt-1 text-sm text-muted">
            Click "Add Branch" to create your first gym location.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`card flex flex-col p-6 transition hover:-translate-y-1 hover:border-gold/40 ${
                b.status === "inactive" ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-charcoal text-sm font-semibold text-gold-light">
                    {b.code || b.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-semibold">{b.name}</p>
                    <p className="text-xs text-muted">{b.city}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs capitalize ${
                    b.status === "active"
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-slate-500/10 text-slate-600"
                  }`}
                >
                  {b.status}
                </span>
              </div>

              <div className="mt-5 space-y-2 text-sm text-muted">
                <p className="flex items-start gap-2">
                  <MapPin size={15} className="mt-0.5 shrink-0" /> {b.address}
                </p>
                {b.phone && (
                  <p className="flex items-center gap-2">
                    <Phone size={15} className="shrink-0" /> {b.phone}
                  </p>
                )}
                {b.email && (
                  <p className="flex items-center gap-2">
                    <Mail size={15} className="shrink-0" /> {b.email}
                  </p>
                )}
                {b.managerName && (
                  <p className="flex items-center gap-2">
                    <User size={15} className="shrink-0" /> Manager: {b.managerName}
                  </p>
                )}
                <p className="flex items-center gap-2">
                  <Clock size={15} className="shrink-0" />
                  {b.openTime && b.closeTime
                    ? `${fmtTime(b.openTime)} – ${fmtTime(b.closeTime)}`
                    : "Hours not set"}
                  {b.weeklyOff && b.weeklyOff !== "No weekly off" && (
                    <span className="text-xs">· Off on {b.weeklyOff}</span>
                  )}
                </p>
              </div>

              {(b.facilities ?? []).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {(b.facilities ?? []).map((f) => (
                    <span
                      key={f}
                      className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 text-[11px] text-gold-soft"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-auto flex justify-end gap-1 border-t border-line pt-4">
                <button
                  title="Edit"
                  onClick={() => setModal({ open: true, branch: b })}
                  className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                >
                  <Pencil size={16} />
                </button>
                <button
                  title={b.status === "active" ? "Deactivate" : "Activate"}
                  onClick={() => toggleStatus(b)}
                  className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                >
                  {b.status === "active" ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                </button>
                <button
                  title="Delete"
                  onClick={() => remove(b)}
                  className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <BranchModal
          key={modal.branch?.id ?? "new"}
          branch={modal.branch}
          onClose={() => setModal({ open: false, branch: null })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
