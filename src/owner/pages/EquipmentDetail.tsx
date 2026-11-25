import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Clock,
  Dumbbell,
  IndianRupee,
  Pencil,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";
import { db } from "../../firebase";
import { useAuth } from "../../AuthContext";
import { useOwner } from "../OwnerContext";
import type { Equipment, EquipmentInput, EquipmentLog } from "../inventoryTypes";
import { EQUIP_STATUS, whenOf } from "../inventoryUi";
import { addDays, daysBetween, fmtDate, rupee, todayStr } from "../utils";
import EquipmentModal from "../components/EquipmentModal";
import MaintenanceModal from "../components/MaintenanceModal";

// The maintenance log fields are read defensively, so this page works
// even if your EquipmentLog type names them slightly differently.
const str = (o: object, k: string) => {
  const v = (o as Record<string, unknown>)[k];
  return typeof v === "string" ? v : "";
};
const num = (o: object, k: string) => {
  const v = (o as Record<string, unknown>)[k];
  return typeof v === "number" ? v : 0;
};

const ageText = (from: string, today: string) => {
  const days = daysBetween(from, today);
  if (days < 0) return "—";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years === 0 && months === 0) return `${days} day${days === 1 ? "" : "s"}`;
  return [years ? `${years} yr` : "", months ? `${months} mo` : ""].filter(Boolean).join(" ");
};

export default function EquipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { businessId, branches, branchId } = useOwner();
  const { profile } = useAuth();
  const actor = profile?.name || "Staff";
  const today = todayStr();

  const [item, setItem] = useState<Equipment | null>(null);
  const [logs, setLogs] = useState<EquipmentLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);

  useEffect(() => {
    if (!businessId || !id) return;

    const u1 = onSnapshot(
      doc(db, "businesses", businessId, "equipment", id),
      (snap) => {
        setItem(snap.exists() ? ({ id: snap.id, ...snap.data() }) as Equipment : null);
        setLoaded(true);
      },
      () => setLoaded(true)
    );

    const u2 = onSnapshot(
      query(collection(db, "businesses", businessId, "equipmentLogs"), where("equipmentId", "==", id)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EquipmentLog);
        list.sort(
          (a, b) =>
            (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
        );
        setLogs(list);
      },
      () => {
        /* logs are optional */
      }
    );

    return () => {
      u1();
      u2();
    };
  }, [businessId, id]);

  const stats = useMemo(() => {
    const maintCost = logs.reduce((s, l) => s + num(l, "cost"), 0);
    return { maintCost, jobs: logs.length };
  }, [logs]);

  if (!loaded) {
    return (
      <div className="grid place-items-center p-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
      </div>
    );
  }

  if (!item || !businessId) {
    return (
      <div className="card grid place-items-center p-16 text-center">
        <p className="font-display text-xl">Equipment not found</p>
        <Link to="/app/inventory" className="btn-gold mt-5 px-5 py-2 text-sm">
          Back to inventory
        </Link>
      </div>
    );
  }

  const st = EQUIP_STATUS[item.status];
  const activeBranches = branches.filter((b) => b.status === "active");

  // Service schedule
  const hasSchedule = item.serviceEveryDays > 0 && !!item.nextServiceDate;
  const toNext = hasSchedule ? daysBetween(today, item.nextServiceDate) : null;
  const cycleStart = item.nextServiceDate
    ? addDays(item.nextServiceDate, -item.serviceEveryDays)
    : "";
  const progress = hasSchedule
    ? Math.min(
        100,
        Math.max(0, (daysBetween(cycleStart, today) / item.serviceEveryDays) * 100)
      )
    : 0;
  const overdue = toNext !== null && toNext < 0;

  // Warranty
  const warrantyLeft = item.warrantyUntil ? daysBetween(today, item.warrantyUntil) : null;

  const totalCost = (item.purchasePrice || 0) + stats.maintCost;

  const saveEquipment = async (data: EquipmentInput) => {
    const branch = branches.find((b) => b.id === data.branchId);
    const base = data.lastServiceDate || data.purchaseDate || todayStr();
    await updateDoc(doc(db, "businesses", businessId, "equipment", item.id), {
      ...data,
      branchName: branch?.name ?? item.branchName,
      nextServiceDate: data.serviceEveryDays > 0 ? addDays(base, data.serviceEveryDays) : "",
      updatedAt: serverTimestamp(),
    });
  };

  const remove = async () => {
    if (
      !window.confirm(
        `Delete "${item.name}"? This cannot be undone. If the machine is just gone, set it to Retired instead.`
      )
    )
      return;
    await deleteDoc(doc(db, "businesses", businessId, "equipment", item.id));
    navigate("/app/inventory");
  };

  const cards = [
    {
      label: "Status",
      value: st.label,
      sub: item.branchName,
      icon: Dumbbell,
    },
    {
      label: "Age",
      value: item.purchaseDate ? ageText(item.purchaseDate, today) : "—",
      sub: item.purchaseDate ? `Bought ${fmtDate(item.purchaseDate)}` : "Purchase date not set",
      icon: Clock,
    },
    {
      label: "Maintenance Jobs",
      value: String(stats.jobs),
      sub: `${rupee(stats.maintCost)} spent in total`,
      icon: Wrench,
    },
    {
      label: "Cost of Ownership",
      value: rupee(totalCost),
      sub: "Purchase price plus maintenance",
      icon: IndianRupee,
    },
  ];

  const btn =
    "flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm transition hover:border-gold/50";

  return (
    <div className="space-y-8">
      <Link
        to="/app/inventory"
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-charcoal"
      >
        <ArrowLeft size={16} /> Back to inventory
      </Link>

      {/* Header */}
      <div className="card flex flex-wrap items-center justify-between gap-5 p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-charcoal text-gold-light">
            <Dumbbell size={26} />
          </div>
          <div>
            <h1 className="font-display text-3xl font-semibold">{item.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {item.category}
              {item.brand ? ` · ${item.brand}` : ""}
              {item.serialNo ? ` · Serial ${item.serialNo}` : ""}
            </p>
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs ${st.cls}`}>
              {st.label}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMaintOpen(true)}
            className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <Wrench size={16} /> Maintenance
          </button>
          <button onClick={() => setEditOpen(true)} className={btn}>
            <Pencil size={16} /> Edit
          </button>
          <button onClick={remove} className={`${btn} hover:!border-red-400 hover:text-red-600`}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {(overdue || item.status === "out_of_order") && (
        <div className="card flex items-center gap-3 !border-red-300 p-5 text-sm">
          <AlertTriangle size={18} className="shrink-0 text-red-600" />
          {item.status === "out_of_order"
            ? "This machine is out of order. Log a maintenance job when it is repaired and set it back to Working."
            : `Service is overdue by ${-(toNext as number)} day(s). Log a maintenance job to reset the schedule.`}
        </div>
      )}

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
              <p className={`mt-6 font-display text-2xl font-semibold ${dark ? "text-gold-light" : ""}`}>
                {value}
              </p>
              <p className={`mt-1 text-sm ${dark ? "text-white/70" : "text-charcoal"}`}>{label}</p>
              <p className={`mt-0.5 text-xs ${dark ? "text-white/45" : "text-muted"}`}>{sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {/* Service schedule */}
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold-soft">
                <CalendarClock size={18} />
              </div>
              <div>
                <h3 className="font-display text-xl">Service Schedule</h3>
                <p className="text-sm text-muted">
                  {item.serviceEveryDays > 0
                    ? `Serviced every ${item.serviceEveryDays} days`
                    : "No regular service is set for this machine"}
                </p>
              </div>
            </div>

            {hasSchedule && (
              <div className="mt-6">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted">
                    Last service {item.lastServiceDate ? fmtDate(item.lastServiceDate) : "—"}
                  </span>
                  <span
                    className={
                      overdue
                        ? "font-medium text-red-600"
                        : (toNext as number) <= 7
                          ? "font-medium text-amber-700"
                          : "text-muted"
                    }
                  >
                    {overdue
                      ? `Overdue by ${-(toNext as number)} day(s)`
                      : toNext === 0
                        ? "Due today"
                        : `Due ${fmtDate(item.nextServiceDate)} (${toNext} days)`}
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gold/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      overdue ? "bg-red-500" : "bg-gradient-to-r from-gold-light to-gold"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card overflow-hidden">
            <div className="p-6 pb-4">
              <h3 className="font-display text-xl">Maintenance History</h3>
              <p className="text-sm text-muted">{stats.jobs} job(s) logged</p>
            </div>

            {logs.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted">
                No maintenance has been logged yet. Click Maintenance to add the first job.
              </p>
            ) : (
              <div className="space-y-3 px-6 pb-6">
                {logs.map((l) => {
                  const type = str(l, "type") || str(l, "kind") || "Maintenance";
                  const note = str(l, "note") || str(l, "notes") || str(l, "description");
                  const cost = num(l, "cost");
                  const date = str(l, "date");
                  const by = str(l, "by");
                  return (
                    <div key={l.id} className="rounded-xl border border-line bg-white/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs capitalize text-gold-soft">
                          {type.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-muted">
                          {date ? fmtDate(date) : whenOf(l.createdAt)}
                          {by ? ` · ${by}` : ""}
                        </span>
                      </div>
                      {note && <p className="mt-2 text-sm">{note}</p>}
                      {cost > 0 && (
                        <p className="mt-1 text-xs text-muted">Cost: {rupee(cost)}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="font-display text-xl">Specifications</h3>
            <dl className="mt-5 space-y-4 text-sm">
              {[
                ["Category", item.category],
                ["Brand", item.brand || "—"],
                ["Serial number", item.serialNo || "—"],
                ["Branch", item.branchName || "—"],
                ["Purchase date", item.purchaseDate ? fmtDate(item.purchaseDate) : "—"],
                ["Purchase price", item.purchasePrice > 0 ? rupee(item.purchasePrice) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold-soft">
                <ShieldCheck size={18} />
              </div>
              <h3 className="font-display text-xl">Warranty</h3>
            </div>
            {warrantyLeft === null ? (
              <p className="mt-4 text-sm text-muted">No warranty date was entered.</p>
            ) : warrantyLeft < 0 ? (
              <p className="mt-4 text-sm text-red-600">
                The warranty ended on {fmtDate(item.warrantyUntil)} ({-warrantyLeft} days ago).
              </p>
            ) : (
              <p className="mt-4 text-sm">
                Covered until <b>{fmtDate(item.warrantyUntil)}</b>
                <span className="text-muted"> ({warrantyLeft} days left)</span>
                {warrantyLeft <= 30 && (
                  <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700">
                    Ending soon
                  </span>
                )}
              </p>
            )}
          </div>

          {item.notes && (
            <div className="card p-6">
              <h3 className="font-display text-xl">Notes</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{item.notes}</p>
            </div>
          )}
        </div>
      </div>

      {editOpen && (
        <EquipmentModal
          key={item.id}
          item={item}
          branches={activeBranches}
          defaultBranchId={
            branchId !== "all" && activeBranches.some((b) => b.id === branchId)
              ? branchId
              : (activeBranches[0]?.id ?? "")
          }
          onClose={() => setEditOpen(false)}
          onSave={saveEquipment}
        />
      )}

      {maintOpen && (
        <MaintenanceModal
          key={item.id}
          businessId={businessId}
          item={item}
          logs={logs}
          by={actor}
          onClose={() => setMaintOpen(false)}
        />
      )}
    </div>
  );
}