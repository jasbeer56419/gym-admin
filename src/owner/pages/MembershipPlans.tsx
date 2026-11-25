import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  BadgeCheck,
  Check,
  MapPin,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Snowflake,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { db } from "../../firebase";
import type { Member, MembershipPlan, MembershipPlanInput } from "../../types";
import { useOwner } from "../OwnerContext";
import { durationLabel, rupee } from "../utils";
import MembershipPlanModal from "../components/MembershipPlanModal";

// Example plans. The owner can edit prices and details after creating them.
const STARTERS: MembershipPlanInput[] = [
  {
    name: "7-Day Trial",
    description: "Try the gym before joining",
    durationValue: 7,
    durationUnit: "day",
    price: 199,
    joiningFee: 0,
    maxFreezeDays: 0,
    branchIds: [],
    inclusions: ["Full gym access"],
    isTrial: true,
    status: "active",
  },
  {
    name: "Monthly",
    description: "",
    durationValue: 1,
    durationUnit: "month",
    price: 1500,
    joiningFee: 500,
    maxFreezeDays: 0,
    branchIds: [],
    inclusions: ["Full gym access", "Locker"],
    isTrial: false,
    status: "active",
  },
  {
    name: "Quarterly",
    description: "",
    durationValue: 3,
    durationUnit: "month",
    price: 4000,
    joiningFee: 500,
    maxFreezeDays: 7,
    branchIds: [],
    inclusions: ["Full gym access", "Locker"],
    isTrial: false,
    status: "active",
  },
  {
    name: "Half-Yearly",
    description: "",
    durationValue: 6,
    durationUnit: "month",
    price: 7000,
    joiningFee: 0,
    maxFreezeDays: 15,
    branchIds: [],
    inclusions: ["Full gym access", "Locker", "1 free diet consultation"],
    isTrial: false,
    status: "active",
  },
  {
    name: "Annual",
    description: "",
    durationValue: 12,
    durationUnit: "month",
    price: 12000,
    joiningFee: 0,
    maxFreezeDays: 30,
    branchIds: [],
    inclusions: ["Full gym access", "Locker", "Steam & sauna", "2 free PT sessions"],
    isTrial: false,
    status: "active",
  },
];

const approxDays = (p: MembershipPlan) =>
  p.durationUnit === "month" ? p.durationValue * 30 : p.durationValue;

export default function MembershipPlans() {
  const { businessId, branches } = useOwner();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; plan: MembershipPlan | null }>({
    open: false,
    plan: null,
  });

  useEffect(() => {
    if (!businessId) return;

    const unsubPlans = onSnapshot(
      collection(db, "businesses", businessId, "membershipPlans"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MembershipPlan);
        list.sort((a, b) => approxDays(a) - approxDays(b));
        setPlans(list);
        setLoading(false);
      },
      () => {
        setError("Could not load membership plans. Please try again.");
        setLoading(false);
      }
    );

    // How many members currently use each plan
    const unsubMembers = onSnapshot(
      collection(db, "businesses", businessId, "members"),
      (snap) => {
        const counts: Record<string, number> = {};
        snap.docs.forEach((d) => {
          const m = d.data() as Member;
          if (m.archived || !m.membershipPlanId) return;
          counts[m.membershipPlanId] = (counts[m.membershipPlanId] ?? 0) + 1;
        });
        setUsage(counts);
      }
    );

    return () => {
      unsubPlans();
      unsubMembers();
    };
  }, [businessId]);

  const handleSave = async (data: MembershipPlanInput) => {
    if (!businessId) return;
    if (modal.plan) {
      await updateDoc(doc(db, "businesses", businessId, "membershipPlans", modal.plan.id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, "businesses", businessId, "membershipPlans"), {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
  };

  const toggleStatus = async (p: MembershipPlan) => {
    if (!businessId) return;
    await updateDoc(doc(db, "businesses", businessId, "membershipPlans", p.id), {
      status: p.status === "active" ? "inactive" : "active",
    });
  };

  const remove = async (p: MembershipPlan) => {
    if (!businessId) return;
    const inUse = usage[p.id] ?? 0;
    if (inUse > 0) {
      window.alert(
        `"${p.name}" is currently used by ${inUse} member(s). Deactivate it instead, so it can no longer be sold.`
      );
      return;
    }
    if (window.confirm(`Delete the "${p.name}" plan? This cannot be undone.`)) {
      await deleteDoc(doc(db, "businesses", businessId, "membershipPlans", p.id));
    }
  };

  const createStarters = async () => {
    if (!businessId) return;
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      STARTERS.forEach((p) => {
        batch.set(doc(collection(db, "businesses", businessId, "membershipPlans")), {
          ...p,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } finally {
      setSeeding(false);
    }
  };

  const branchText = (p: MembershipPlan) => {
    const ids = p.branchIds ?? [];
    if (ids.length === 0) return "All branches";
    return (
      ids
        .map((id) => branches.find((b) => b.id === id)?.name)
        .filter(Boolean)
        .join(", ") || "Selected branches"
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Gym Operations</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Membership <span className="gold-text">Plans</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Create the plans you sell to members: pricing, duration, freeze rules and branch
            access.
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, plan: null })}
          className="btn-gold flex items-center gap-2 px-5 py-3 text-sm"
        >
          <Plus size={18} /> Add Plan
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center p-20">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
        </div>
      ) : error ? (
        <p className="card p-10 text-center text-sm text-red-700">{error}</p>
      ) : plans.length === 0 ? (
        <div className="card grid place-items-center p-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
            <BadgeCheck size={24} />
          </div>
          <p className="mt-4 font-display text-xl">No membership plans yet</p>
          <p className="mt-1 max-w-md text-sm text-muted">
            Create 5 starter plans in one click (Trial, Monthly, Quarterly, Half-Yearly and
            Annual). The prices are examples, so edit them to match your gym. Or build your
            own with "Add Plan".
          </p>
          <button
            onClick={createStarters}
            disabled={seeding}
            className="btn-gold mt-6 flex items-center gap-2 px-6 py-3 text-sm"
          >
            <Sparkles size={17} /> {seeding ? "Creating..." : "Create Starter Plans"}
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const members = usage[p.id] ?? 0;
            return (
              <div
                key={p.id}
                className={`card flex flex-col p-7 transition hover:-translate-y-1 hover:border-gold/40 ${
                  p.status === "inactive" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-2xl font-semibold">{p.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {durationLabel(p.durationValue, p.durationUnit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {p.isTrial && (
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] text-gold-soft">
                        Trial
                      </span>
                    )}
                    {p.status === "inactive" && (
                      <span className="rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[11px] text-slate-600">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-5 font-display text-4xl font-semibold">{rupee(p.price)}</p>
                <p className="text-xs text-muted">
                  {p.joiningFee > 0
                    ? `+ ${rupee(p.joiningFee)} joining fee (first membership)`
                    : "No joining fee"}
                </p>

                {p.description && <p className="mt-3 text-sm text-muted">{p.description}</p>}

                <div className="mt-4 space-y-1.5 text-sm text-muted">
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="shrink-0" /> {branchText(p)}
                  </p>
                  <p className="flex items-center gap-2">
                    <Snowflake size={14} className="shrink-0" />
                    {p.maxFreezeDays > 0
                      ? `Freeze up to ${p.maxFreezeDays} days`
                      : "Cannot be frozen"}
                  </p>
                </div>

                {(p.inclusions ?? []).length > 0 && (
                  <ul className="mt-4 flex-1 space-y-2">
                    {p.inclusions.map((i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check size={15} className="mt-0.5 shrink-0 text-gold-soft" /> {i}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    <Users size={15} /> {members} member{members === 1 ? "" : "s"}
                  </span>
                  <div className="flex gap-1">
                    <button
                      title="Edit"
                      onClick={() => setModal({ open: true, plan: p })}
                      className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      title={p.status === "active" ? "Deactivate" : "Activate"}
                      onClick={() => toggleStatus(p)}
                      className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                    >
                      {p.status === "active" ? (
                        <PauseCircle size={16} />
                      ) : (
                        <PlayCircle size={16} />
                      )}
                    </button>
                    <button
                      title="Delete"
                      onClick={() => remove(p)}
                      className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal.open && (
        <MembershipPlanModal
          key={modal.plan?.id ?? "new"}
          plan={modal.plan}
          branches={branches}
          onClose={() => setModal({ open: false, plan: null })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}