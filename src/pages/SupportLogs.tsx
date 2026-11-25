import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { CheckCircle2, LifeBuoy, Plus, ScrollText, Search, X } from "lucide-react";
import { db } from "../firebase";
import { logAction } from "../audit";
import { useCollection } from "../useCollection";
import type { AuditLog, Business, Ticket, TicketPriority } from "../types";

type Tab = "tickets" | "logs";

const prioStyle: Record<TicketPriority, string> = {
  low: "bg-sky-500/10 text-sky-700",
  medium: "bg-amber-500/10 text-amber-700",
  high: "bg-red-500/10 text-red-700",
};

const fmt = (t?: { toDate: () => Date } | null) =>
  t
    ? t.toDate().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "just now";

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function SupportLogs() {
  const [tab, setTab] = useState<Tab>("tickets");

  // ---------- Logs ----------
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState("");
  const [q, setQ] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(200)),
      (snap) => {
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog));
        setLogsLoading(false);
      },
      () => {
        setLogsError("Could not load logs. Did you add auditLogs to your Firestore rules?");
        setLogsLoading(false);
      }
    );
    return unsub;
  }, []);

  const modules = useMemo(
    () => ["all", ...Array.from(new Set(logs.map((l) => l.module)))],
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const s = q.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (moduleFilter === "all" || l.module === moduleFilter) &&
        (!s ||
          l.target.toLowerCase().includes(s) ||
          l.action.toLowerCase().includes(s) ||
          l.actorEmail.toLowerCase().includes(s))
    );
  }, [logs, q, moduleFilter]);

  // ---------- Tickets ----------
  const tk = useCollection<Ticket>("tickets");
  const biz = useCollection<Business>("businesses");
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [form, setForm] = useState({
    subject: "",
    message: "",
    businessName: "",
    priority: "medium" as TicketPriority,
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const tickets = useMemo(() => {
    const list = tk.data.filter((t) => statusFilter === "all" || t.status === statusFilter);
    return list.sort((a, b) => (b.createdAt?.seconds ?? 9e12) - (a.createdAt?.seconds ?? 9e12));
  }, [tk.data, statusFilter]);

  const openCount = tk.data.filter((t) => t.status === "open").length;

  const createTicket = async (e: SyntheticEvent) => {
    e.preventDefault();
    setFormError("");
    setBusy(true);
    try {
      await addDoc(collection(db, "tickets"), {
        subject: form.subject.trim(),
        message: form.message.trim(),
        businessName: form.businessName,
        priority: form.priority,
        status: "open",
        createdAt: serverTimestamp(),
        resolvedAt: null,
      });
      await logAction("Support", "Ticket created", form.subject.trim());
      setForm({ subject: "", message: "", businessName: "", priority: "medium" });
      setShowForm(false);
    } catch {
      setFormError("Could not save the ticket. Did you add tickets to your Firestore rules?");
    }
    setBusy(false);
  };

  const resolve = async (t: Ticket) => {
    await updateDoc(doc(db, "tickets", t.id), {
      status: "resolved",
      resolvedAt: serverTimestamp(),
    });
    await logAction("Support", "Ticket resolved", t.subject);
  };

  const reopen = async (t: Ticket) => {
    await updateDoc(doc(db, "tickets", t.id), { status: "open", resolvedAt: null });
    await logAction("Support", "Ticket reopened", t.subject);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Help desk</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Support & <span className="gold-text">Logs</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            Tickets from business owners and a record of every activity in the panel.
          </p>
        </div>
        {tab === "tickets" && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-gold flex items-center gap-2 px-5 py-3 text-sm"
          >
            <Plus size={18} /> New Ticket
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {[
          { id: "tickets" as Tab, text: `Tickets (${openCount} open)`, icon: LifeBuoy },
          { id: "logs" as Tab, text: "Activity Logs", icon: ScrollText },
        ].map(({ id, text, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
              tab === id
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-line text-muted hover:text-charcoal"
            }`}
          >
            <Icon size={16} /> {text}
          </button>
        ))}
      </div>

      {tab === "tickets" ? (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap gap-2 border-b border-line p-5">
            {(["open", "resolved", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg border px-4 py-2 text-sm capitalize transition ${
                  statusFilter === s
                    ? "border-gold/50 bg-gold/15 text-gold-soft"
                    : "border-line text-muted hover:text-charcoal"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {tk.loading ? (
            <div className="grid place-items-center p-16">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
            </div>
          ) : tk.error ? (
            <p className="p-10 text-center text-sm text-red-700">
              Could not load tickets. Please check your Firestore rules.
            </p>
          ) : tickets.length === 0 ? (
            <p className="p-14 text-center text-sm text-muted">
              No tickets. Create your first one with New Ticket.
            </p>
          ) : (
            <ul>
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-start justify-between gap-4 border-b border-line/60 px-6 py-5 last:border-0"
                >
                  <div className="min-w-[240px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{t.subject}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ${prioStyle[t.priority]}`}>
                        {t.priority}
                      </span>
                      {t.status === "resolved" && (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-700">
                          Resolved
                        </span>
                      )}
                    </div>
                    {t.message && <p className="mt-1 text-sm text-muted">{t.message}</p>}
                    <p className="mt-2 text-xs text-muted">
                      {t.businessName || "No business"} · {fmt(t.createdAt)}
                    </p>
                  </div>
                  {t.status === "open" ? (
                    <button
                      onClick={() => resolve(t)}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-2 text-sm text-emerald-700 transition hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 size={16} /> Mark resolved
                    </button>
                  ) : (
                    <button
                      onClick={() => reopen(t)}
                      className="rounded-lg border border-line px-3 py-2 text-sm text-muted transition hover:text-charcoal"
                    >
                      Reopen
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line p-5">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                placeholder="Search by action, target or email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="input-lux !py-2.5 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {modules.map((m) => (
                <button
                  key={m}
                  onClick={() => setModuleFilter(m)}
                  className={`rounded-lg border px-4 py-2 text-sm capitalize transition ${
                    moduleFilter === m
                      ? "border-gold/50 bg-gold/15 text-gold-soft"
                      : "border-line text-muted hover:text-charcoal"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {logsLoading ? (
            <div className="grid place-items-center p-16">
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
            </div>
          ) : logsError ? (
            <p className="p-10 text-center text-sm text-red-700">{logsError}</p>
          ) : filteredLogs.length === 0 ? (
            <p className="p-14 text-center text-sm text-muted">
              No activity yet. It will show up here when you edit a user or a plan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                    <th className="px-6 py-4 font-medium">When</th>
                    <th className="px-6 py-4 font-medium">Who</th>
                    <th className="px-6 py-4 font-medium">Module</th>
                    <th className="px-6 py-4 font-medium">Action</th>
                    <th className="px-6 py-4 font-medium">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="border-b border-line/60 last:border-0 hover:bg-gold/5">
                      <td className="whitespace-nowrap px-6 py-3 text-muted">{fmt(l.createdAt)}</td>
                      <td className="px-6 py-3">{l.actorEmail || "—"}</td>
                      <td className="px-6 py-3">
                        <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-xs text-gold-soft">
                          {l.module}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-medium">{l.action}</td>
                      <td className="px-6 py-3 text-muted">{l.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />
          <form onSubmit={createTicket} className="card relative my-8 w-full max-w-xl !bg-white p-8">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="absolute right-5 top-5 text-muted hover:text-charcoal"
            >
              <X size={20} />
            </button>
            <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">New Ticket</p>
            <h2 className="mt-1 font-display text-2xl font-semibold">Create a Ticket</h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>Subject</label>
                <input
                  className={field}
                  required
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                />
              </div>
              <div>
                <label className={label}>Business</label>
                <select
                  className={field}
                  value={form.businessName}
                  onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                >
                  <option value="">None</option>
                  {biz.data.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Priority</label>
                <select
                  className={field}
                  value={form.priority}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, priority: e.target.value as TicketPriority }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Details</label>
                <textarea
                  rows={4}
                  className={field}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
            </div>

            {formError && (
              <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:text-charcoal"
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-gold px-6 py-2.5 text-sm">
                {busy ? "Saving..." : "Create Ticket"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
