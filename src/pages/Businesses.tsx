import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Building2,
  CheckCircle2,
  Clock,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { db } from "../firebase";
import type { Business, BusinessInput, BusinessStatus } from "../types";
import BusinessModal from "../components/BusinessModal";

type Filter = "all" | BusinessStatus;

const statusStyle: Record<BusinessStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  pending: "bg-amber-500/10 text-amber-700",
  suspended: "bg-red-500/10 text-red-700",
};

export default function Businesses() {
  const [items, setItems] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [modal, setModal] = useState<{ open: boolean; business: Business | null }>({
    open: false,
    business: null,
  });

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "businesses"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Business);
        list.sort(
          (a, b) => (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12)
        );
        setItems(list);
        setLoading(false);
      },
      () => {
        setLoadError("Could not load businesses. Please check your Firestore rules.");
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((b) => {
      const okStatus = filter === "all" || b.status === filter;
      const okSearch =
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.ownerName.toLowerCase().includes(q) ||
        (b.city ?? "").toLowerCase().includes(q);
      return okStatus && okSearch;
    });
  }, [items, search, filter]);

  const count = (s: BusinessStatus) => items.filter((b) => b.status === s).length;

  const handleSave = async (data: BusinessInput) => {
    if (modal.business) {
      await updateDoc(doc(db, "businesses", modal.business.id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, "businesses"), {
        ...data,
        createdAt: serverTimestamp(),
      });
    }
  };

  const setStatus = async (b: Business, status: BusinessStatus) => {
    if (
      status === "suspended" &&
      !window.confirm(`Suspend "${b.name}"? The owner will lose access immediately.`)
    ) {
      return;
    }
    await updateDoc(doc(db, "businesses", b.id), { status });
  };

  const remove = async (b: Business) => {
    if (window.confirm(`Delete "${b.name}"? This cannot be undone.`)) {
      await deleteDoc(doc(db, "businesses", b.id));
    }
  };

  const fmtDate = (b: Business) =>
    b.createdAt
      ? b.createdAt.toDate().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  const summary: { label: string; value: number; filter: Filter }[] = [
    { label: "Total Businesses", value: items.length, filter: "all" },
    { label: "Pending Approval", value: count("pending"), filter: "pending" },
    { label: "Active", value: count("active"), filter: "active" },
    { label: "Suspended", value: count("suspended"), filter: "suspended" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Tenants</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Manage <span className="gold-text">Businesses</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Every gym business on the platform is managed from here.
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, business: null })}
          className="btn-gold flex items-center gap-2 px-5 py-3 text-sm"
        >
          <Plus size={18} /> Add Business
        </button>
      </div>

      {/* Pending banner */}
      {count("pending") > 0 && filter !== "pending" && (
        <div className="card flex flex-wrap items-center justify-between gap-3 !border-gold/50 p-5">
          <p className="flex items-center gap-2 text-sm">
            <Clock size={18} className="text-gold-soft" />
            <b>{count("pending")}</b> gym{count("pending") === 1 ? " is" : "s are"} waiting for
            your approval.
          </p>
          <button
            onClick={() => setFilter("pending")}
            className="btn-gold px-5 py-2 text-sm"
          >
            Review now
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((s) => (
          <button
            key={s.label}
            onClick={() => setFilter(s.filter)}
            className={`card p-5 text-left transition hover:-translate-y-1 hover:border-gold/40 ${
              filter === s.filter ? "!border-gold/60" : ""
            }`}
          >
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{s.value}</p>
          </button>
        ))}
      </div>

      {/* Table card */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              placeholder="Search by name, owner or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-lux !py-2.5 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "pending", "active", "suspended"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg border px-4 py-2 text-sm capitalize transition ${
                  filter === f
                    ? "border-gold/50 bg-gold/15 text-gold-soft"
                    : "border-line text-muted hover:text-charcoal"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center p-16">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
          </div>
        ) : loadError ? (
          <p className="p-10 text-center text-sm text-red-700">{loadError}</p>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
              <Building2 size={24} />
            </div>
            <p className="mt-4 font-display text-xl">
              {items.length === 0 ? "No businesses yet" : "No matches found"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {items.length === 0
                ? "Gym owners can sign up themselves, or click \"Add Business\" above."
                : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <th className="px-6 py-4 font-medium">Business</th>
                  <th className="px-6 py-4 font-medium">Owner</th>
                  <th className="px-6 py-4 font-medium">City</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium">Branches</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Joined</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-b border-line/60 transition last:border-0 hover:bg-gold/5 ${
                      b.status === "pending" ? "bg-amber-500/[0.04]" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-charcoal text-gold-light">
                          {b.name[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium">{b.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p>{b.ownerName}</p>
                      <p className="text-xs text-muted">{b.ownerEmail}</p>
                    </td>
                    <td className="px-6 py-4 text-muted">{b.city || "—"}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs text-gold-soft">
                        {b.plan || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">{b.branches}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs capitalize ${
                          statusStyle[b.status] ?? statusStyle.active
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted">{fmtDate(b)}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        {b.status === "pending" && (
                          <button
                            title="Approve"
                            onClick={() => setStatus(b, "active")}
                            className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-500/20"
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                        )}
                        <button
                          title="Edit"
                          onClick={() => setModal({ open: true, business: b })}
                          className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                        >
                          <Pencil size={16} />
                        </button>
                        {b.status !== "pending" && (
                          <button
                            title={b.status === "active" ? "Suspend" : "Activate"}
                            onClick={() =>
                              setStatus(b, b.status === "active" ? "suspended" : "active")
                            }
                            className="rounded-lg p-2 text-muted transition hover:bg-black/5 hover:text-charcoal"
                          >
                            {b.status === "active" ? (
                              <PauseCircle size={16} />
                            ) : (
                              <PlayCircle size={16} />
                            )}
                          </button>
                        )}
                        <button
                          title="Delete"
                          onClick={() => remove(b)}
                          className="rounded-lg p-2 text-muted transition hover:bg-red-500/10 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <BusinessModal
          key={modal.business?.id ?? "new"}
          business={modal.business}
          onClose={() => setModal({ open: false, business: null })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
