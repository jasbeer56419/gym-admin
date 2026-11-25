import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { Crown, Plus, Pencil, Trash2, Check, Star, Building2, Sparkles } from "lucide-react";
import { db } from "../firebase";
import type { Plan, PlanInput } from "../types";
import PlanModal from "../components/PlanModal";

const DEFAULT_PLANS: PlanInput[] = [
  {
    name: "Starter",
    priceMonthly: 999,
    priceYearly: 9990,
    maxBranches: 1,
    maxMembers: 200,
    maxStaff: 5,
    features: ["Member management", "Attendance tracking", "Basic reports", "Email support"],
    popular: false,
    status: "active",
  },
  {
    name: "Business",
    priceMonthly: 2499,
    priceYearly: 24990,
    maxBranches: 3,
    maxMembers: 1000,
    maxStaff: 20,
    features: [
      "Everything in Starter",
      "Class booking & scheduling",
      "Trainer management",
      "WhatsApp & SMS reminders",
      "Billing & invoices",
    ],
    popular: true,
    status: "active",
  },
  {
    name: "Premium",
    priceMonthly: 4999,
    priceYearly: 49990,
    maxBranches: 0,
    maxMembers: 0,
    maxStaff: 0,
    features: [
      "Everything in Business",
      "Unlimited branches & members",
      "Advanced analytics",
      "Member mobile app",
      "Priority support",
    ],
    popular: false,
    status: "active",
  },
];

const limit = (n: number) => (n === 0 ? "Unlimited" : n.toLocaleString("en-IN"));
const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; plan: Plan | null }>({
    open: false,
    plan: null,
  });

  // Plans (real-time)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "plans"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Plan);
        list.sort((a, b) => a.priceMonthly - b.priceMonthly);
        setPlans(list);
        setLoading(false);
      },
      () => {
        setLoadError("Could not load plans. Please check your Firestore rules.");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // How many businesses are on each plan
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "businesses"), (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const p = d.data().plan as string;
        counts[p] = (counts[p] ?? 0) + 1;
      });
      setUsage(counts);
    });
    return unsub;
  }, []);

  const handleSave = async (data: PlanInput) => {
    const editing = modal.plan;
    if (!editing) {
      await addDoc(collection(db, "plans"), { ...data, createdAt: serverTimestamp() });
      return;
    }

    if (editing.name !== data.name) {
      // Name changed: also update the new name in every business on this plan
      const snap = await getDocs(
        query(collection(db, "businesses"), where("plan", "==", editing.name))
      );
      const batch = writeBatch(db);
      batch.update(doc(db, "plans", editing.id), { ...data, updatedAt: serverTimestamp() });
      snap.docs.forEach((d) => batch.update(d.ref, { plan: data.name }));
      await batch.commit();
    } else {
      await updateDoc(doc(db, "plans", editing.id), { ...data, updatedAt: serverTimestamp() });
    }
  };

  const remove = async (p: Plan) => {
    const inUse = usage[p.name] ?? 0;
    if (inUse > 0) {
      window.alert(
        `"${p.name}" has ${inUse} business(es) on it. Change their plan first, then delete this one.`
      );
      return;
    }
    if (window.confirm(`Delete the "${p.name}" plan?`)) {
      await deleteDoc(doc(db, "plans", p.id));
    }
  };

  const createDefaults = async () => {
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      DEFAULT_PLANS.forEach((p) => {
        batch.set(doc(collection(db, "plans")), { ...p, createdAt: serverTimestamp() });
      });
      await batch.commit();
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Monetization</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Subscription <span className="gold-text">Plans</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Set which plans gym businesses can choose and what each one costs.
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
      ) : loadError ? (
        <p className="card p-10 text-center text-sm text-red-700">{loadError}</p>
      ) : plans.length === 0 ? (
        <div className="card grid place-items-center p-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
            <Crown size={24} />
          </div>
          <p className="mt-4 font-display text-xl">No plans yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Create the Starter, Business and Premium plans in one click (you can edit them
            later), or use "Add Plan" to build your own.
          </p>
          <button
            onClick={createDefaults}
            disabled={seeding}
            className="btn-gold mt-6 flex items-center gap-2 px-6 py-3 text-sm"
          >
            <Sparkles size={17} /> {seeding ? "Creating..." : "Create Default Plans"}
          </button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const dark = p.popular;
            const inUse = usage[p.name] ?? 0;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-3xl p-7 transition hover:-translate-y-1 ${
                  dark
                    ? "border border-gold/50 bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] text-white shadow-2xl shadow-black/30"
                    : "card hover:border-gold/40"
                } ${p.status === "inactive" ? "opacity-60" : ""}`}
              >
                {dark && (
                  <span className="absolute -top-3 left-7 flex items-center gap-1 rounded-full bg-gradient-to-r from-gold-light to-gold px-3 py-1 text-xs font-semibold text-charcoal shadow-lg shadow-gold/30">
                    <Star size={12} fill="currentColor" /> Most Popular
                  </span>
                )}

                <div className="flex items-start justify-between">
                  <h3
                    className={`font-display text-2xl font-semibold ${
                      dark ? "text-gold-light" : ""
                    }`}
                  >
                    {p.name}
                  </h3>
                  {p.status === "inactive" && (
                    <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs text-red-500">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="mt-5">
                  <span className="font-display text-4xl font-semibold">
                    {rupee(p.priceMonthly)}
                  </span>
                  <span className={`text-sm ${dark ? "text-white/60" : "text-muted"}`}>
                    {" "}
                    / month
                  </span>
                  <p className={`mt-1 text-xs ${dark ? "text-white/50" : "text-muted"}`}>
                    or {rupee(p.priceYearly)} / year
                  </p>
                </div>

                <div
                  className={`mt-5 grid grid-cols-3 gap-2 rounded-2xl border p-3 text-center ${
                    dark ? "border-white/10 bg-white/5" : "border-line bg-gold/5"
                  }`}
                >
                  {[
                    ["Branches", limit(p.maxBranches)],
                    ["Members", limit(p.maxMembers)],
                    ["Staff", limit(p.maxStaff)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-sm font-semibold">{v}</p>
                      <p className={`text-[11px] ${dark ? "text-white/50" : "text-muted"}`}>
                        {k}
                      </p>
                    </div>
                  ))}
                </div>

                <ul className="mt-5 flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check
                        size={16}
                        className={`mt-0.5 shrink-0 ${dark ? "text-gold-light" : "text-gold-soft"}`}
                      />
                      <span className={dark ? "text-white/80" : ""}>{f}</span>
                    </li>
                  ))}
                </ul>

                <div
                  className={`mt-6 flex items-center justify-between border-t pt-5 ${
                    dark ? "border-white/10" : "border-line"
                  }`}
                >
                  <span
                    className={`flex items-center gap-1.5 text-sm ${
                      dark ? "text-white/60" : "text-muted"
                    }`}
                  >
                    <Building2 size={15} /> {inUse} gym{inUse === 1 ? "" : "s"}
                  </span>
                  <div className="flex gap-1">
                    <button
                      title="Edit"
                      onClick={() => setModal({ open: true, plan: p })}
                      className={`rounded-lg p-2 transition ${
                        dark
                          ? "text-white/60 hover:bg-white/10 hover:text-white"
                          : "text-muted hover:bg-black/5 hover:text-charcoal"
                      }`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      title="Delete"
                      onClick={() => remove(p)}
                      className={`rounded-lg p-2 transition ${
                        dark
                          ? "text-white/60 hover:bg-red-500/20 hover:text-red-300"
                          : "text-muted hover:bg-red-500/10 hover:text-red-600"
                      }`}
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
        <PlanModal
          key={modal.plan?.id ?? "new"}
          plan={modal.plan}
          onClose={() => setModal({ open: false, plan: null })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
