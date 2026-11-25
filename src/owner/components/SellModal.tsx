import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { X } from "lucide-react";
import type { Member } from "../../types";
import type { Product } from "../inventoryTypes";
import { changeStock } from "../inventoryService";
import { rupee, todayStr } from "../utils";

const METHODS = ["Cash", "UPI", "Card", "Net Banking", "Bank Transfer"];

type Props = {
  businessId: string;
  product: Product;
  members: Member[];
  by: string;
  onClose: () => void;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function SellModal({ businessId, product, members, by, onClose }: Props) {
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(product.sellPrice);
  const [method, setMethod] = useState("Cash");
  const [buyer, setBuyer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = Math.max(0, qty * unitPrice);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!Number.isInteger(qty) || qty < 1) {
      setError("Enter a whole quantity of at least 1.");
      return;
    }
    if (qty > product.stock) {
      setError(`Only ${product.stock} in stock.`);
      return;
    }
    if (unitPrice < 0) {
      setError("The price cannot be negative.");
      return;
    }

    setBusy(true);
    try {
      await changeStock(businessId, product.id, {
        mode: "sale",
        qty,
        note: "",
        by,
        date: todayStr(),
        unitPrice,
        method,
        buyer: buyer.trim(),
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error && !(err instanceof FirebaseError)
          ? err.message
          : "Could not save. Please check your connection and try again."
      );
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="card relative my-8 w-full max-w-lg !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Inventory</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Sell Product</h2>
        <p className="mt-1 text-sm text-muted">
          {product.name} · <b>{product.stock}</b> {product.unit} in stock
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Quantity</label>
            <input
              type="number"
              min={1}
              max={product.stock}
              className={field}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Price per {product.unit} (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Payment Method</label>
            <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Customer (optional)</label>
            <input
              className={field}
              list="sell-members"
              placeholder="Member name or walk-in"
              value={buyer}
              onChange={(e) => setBuyer(e.target.value)}
            />
            <datalist id="sell-members">
              {members
                .filter((m) => !m.archived)
                .map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
            </datalist>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-muted">Total</p>
          <p className="font-display text-2xl font-semibold">{rupee(total)}</p>
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
          <button type="submit" disabled={busy} className="btn-gold px-6 py-2.5 text-sm">
            {busy ? "Saving..." : "Confirm Sale"}
          </button>
        </div>
      </form>
    </div>
  );
}