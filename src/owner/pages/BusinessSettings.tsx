import { useEffect, useState, type FormEvent } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Building2, Receipt, Save } from "lucide-react";
import { db } from "../../firebase";
import type { BusinessSettings } from "../../types";
import { useOwner } from "../OwnerContext";
import { defaultSettings, useSettings } from "../useSettings";

const GST_RATES = [0, 5, 12, 18, 28];
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function SettingsPage() {
  const { businessId, business, plan } = useOwner();
  const saved = useSettings(businessId);

  const [form, setForm] = useState<BusinessSettings>(defaultSettings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setForm(saved);
  }, [saved]);

  const set = <K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) => {
    setDone(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setError("");
    setDone(false);

    const gstin = form.gstin.trim().toUpperCase();
    if (gstin && !GSTIN_PATTERN.test(gstin)) {
      setError("The GSTIN is not valid. It must be 15 characters, like 27ABCDE1234F1Z5.");
      return;
    }
    if (form.showGst && form.gstRate === 0) {
      setError("Choose a GST rate above 0%, or turn off the GST breakup on receipts.");
      return;
    }

    setBusy(true);
    try {
      await setDoc(
        doc(db, "businesses", businessId, "meta", "settings"),
        { ...form, gstin, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setDone(true);
    } catch {
      setError("Could not save. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Setup</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          Business <span className="gold-text">Settings</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Your business details and tax settings. They appear on every receipt you print.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Platform managed info */}
        <div className="card flex flex-wrap items-center gap-4 p-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-charcoal font-display text-xl font-semibold text-gold-light">
            {business?.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold">{business?.name}</p>
            <p className="text-sm text-muted">
              {plan?.name ?? business?.plan} plan ·{" "}
              <span className="capitalize">{business?.status}</span>
            </p>
          </div>
          <p className="max-w-xs text-xs text-muted">
            The business name and plan are managed by the platform administrator.
          </p>
        </div>

        {/* Profile */}
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold-soft">
              <Building2 size={18} />
            </div>
            <h3 className="font-display text-xl">Business Profile</h3>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Business Phone</label>
              <input
                className={field}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>Business Email</label>
              <input
                type="email"
                className={field}
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={label}>Address</label>
              <input
                className={field}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div>
              <label className={label}>City</label>
              <input
                className={field}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>State</label>
                <input
                  className={field}
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Pincode</label>
                <input
                  className={field}
                  inputMode="numeric"
                  value={form.pincode}
                  onChange={(e) => set("pincode", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tax and receipts */}
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gold/10 text-gold-soft">
              <Receipt size={18} />
            </div>
            <h3 className="font-display text-xl">Tax & Receipts</h3>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>GSTIN (optional)</label>
              <input
                className={field}
                placeholder="e.g. 27ABCDE1234F1Z5"
                maxLength={15}
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <label className={label}>GST Rate</label>
              <select
                className={field}
                value={form.gstRate}
                onChange={(e) => set("gstRate", Number(e.target.value))}
              >
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r === 0 ? "No GST (0%)" : `${r}%`}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={form.showGst}
                onChange={(e) => set("showGst", e.target.checked)}
                className="h-4 w-4 accent-[#c9a227]"
              />
              <span className="text-sm">Show the GST breakup (CGST and SGST) on receipts</span>
            </label>

            <p className="-mt-2 text-xs text-muted sm:col-span-2">
              Your plan prices are treated as <b>GST-inclusive</b>. The receipt splits the
              amount paid into the taxable value and the tax.
            </p>

            <div className="sm:col-span-2">
              <label className={label}>Receipt Footer Note</label>
              <textarea
                rows={2}
                className={`${field} resize-none`}
                value={form.receiptNote}
                onChange={(e) => set("receiptNote", e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {done && (
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
            Settings saved.
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="btn-gold flex items-center gap-2 px-6 py-3 text-sm"
          >
            <Save size={16} /> {busy ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}