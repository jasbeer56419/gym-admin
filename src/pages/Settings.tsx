import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { KeyRound, Save } from "lucide-react";
import { auth, db } from "../firebase";
import { useAuth } from "../AuthContext";
import { logAction } from "../audit";
import type { PlatformSettings } from "../types";

const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: "GYMOS",
  supportEmail: "",
  supportPhone: "",
  currency: "INR",
  invoicePrefix: "INV",
  trialDays: 14,
  gstPercent: 18,
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function Settings() {
  const { user } = useAuth();
  const [form, setForm] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "platform"),
      (snap) => {
        if (snap.exists()) {
          setForm({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<PlatformSettings>) });
        }
        setLoading(false);
      },
      () => {
        setMsg({
          ok: false,
          text: "Could not load settings. Did you add the settings rules in Firestore?",
        });
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const save = async (e: SyntheticEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await setDoc(
        doc(db, "settings", "platform"),
        {
          ...form,
          platformName: form.platformName.trim(),
          supportEmail: form.supportEmail.trim(),
          supportPhone: form.supportPhone.trim(),
          invoicePrefix: form.invoicePrefix.trim().toUpperCase(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await logAction("Settings", "Updated", "Platform settings");
      setMsg({ ok: true, text: "Settings saved." });
    } catch {
      setMsg({ ok: false, text: "Could not save. Please check your Firestore rules." });
    }
    setBusy(false);
  };

  const resetMine = async () => {
    const email = user?.email;
    if (!email || !window.confirm(`Send a password reset email to ${email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      window.alert(`Reset email sent to ${email}`);
    } catch {
      window.alert("Could not send the email. Please try again in a while.");
    }
  };

  const num = (k: "trialDays" | "gstPercent") => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: Math.max(0, Number(e.target.value) || 0) }));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Configuration</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          System <span className="gold-text">Settings</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Change the basic platform settings here. Everything is saved in Firebase.
        </p>
      </div>

      {loading ? (
        <div className="grid place-items-center p-20">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <form onSubmit={save} className="card p-8 xl:col-span-2">
            <h3 className="font-display text-xl">Platform</h3>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Platform name</label>
                <input
                  className={field}
                  required
                  value={form.platformName}
                  onChange={(e) => setForm((f) => ({ ...f, platformName: e.target.value }))}
                />
              </div>
              <div>
                <label className={label}>Currency</label>
                <select
                  className={field}
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="AED">AED</option>
                </select>
              </div>
              <div>
                <label className={label}>Support email</label>
                <input
                  type="email"
                  className={field}
                  value={form.supportEmail}
                  onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
                />
              </div>
              <div>
                <label className={label}>Support phone</label>
                <input
                  className={field}
                  value={form.supportPhone}
                  onChange={(e) => setForm((f) => ({ ...f, supportPhone: e.target.value }))}
                />
              </div>
            </div>

            <h3 className="mt-10 font-display text-xl">Billing</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <label className={label}>Invoice prefix</label>
                <input
                  className={field}
                  maxLength={8}
                  value={form.invoicePrefix}
                  onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))}
                />
              </div>
              <div>
                <label className={label}>Free trial (days)</label>
                <input
                  type="number"
                  min={0}
                  className={field}
                  value={form.trialDays}
                  onChange={num("trialDays")}
                />
              </div>
              <div>
                <label className={label}>GST (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={field}
                  value={form.gstPercent}
                  onChange={num("gstPercent")}
                />
              </div>
            </div>

            {msg && (
              <p
                className={`mt-6 rounded-lg border px-3 py-2 text-sm ${
                  msg.ok
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                    : "border-red-500/20 bg-red-500/10 text-red-700"
                }`}
              >
                {msg.text}
              </p>
            )}

            <div className="mt-8 flex justify-end">
              <button type="submit" disabled={busy} className="btn-gold flex items-center gap-2 px-6 py-2.5 text-sm">
                <Save size={16} /> {busy ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>

          <div className="card h-fit p-8">
            <h3 className="font-display text-xl">My account</h3>
            <p className="mt-4 text-sm text-muted">Logged in as</p>
            <p className="break-all font-medium">{user?.email}</p>
            <button
              onClick={resetMine}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-5 py-2.5 text-sm text-muted transition hover:text-charcoal"
            >
              <KeyRound size={16} /> Send password reset email
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
