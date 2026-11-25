import { useState, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { X } from "lucide-react";
import type { Product } from "../inventoryTypes";
import { changeStock } from "../inventoryService";
import { todayStr } from "../utils";

type Mode = "in" | "out" | "adjust";

type Props = {
  businessId: string;
  product: Product;
  mode: Mode;
  by: string;
  onClose: () => void;
};

const TITLES: Record<Mode, string> = {
  in: "Add Stock",
  out: "Remove Stock",
  adjust: "Correct Stock Count",
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function StockModal({ businessId, product, mode, by, onClose }: Props) {
  const [qty, setQty] = useState(mode === "adjust" ? product.stock : 1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!Number.isInteger(qty)) {
      setError("Please enter a whole number.");
      return;
    }
    if (mode === "adjust" ? qty < 0 : qty < 1) {
      setError(mode === "adjust" ? "The count cannot be negative." : "Enter a quantity of at least 1.");
      return;
    }
    if (mode !== "in" && !note.trim()) {
      setError("Please give a reason. It is saved in the stock history.");
      return;
    }
    if (mode === "out" && qty > product.stock) {
      setError(`Only ${product.stock} in stock.`);
      return;
    }

    setBusy(true);
    try {
      await changeStock(businessId, product.id, {
        mode,
        qty,
        note: note.trim(),
        by,
        date: todayStr(),
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
        className="card relative my-8 w-full max-w-md !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">Inventory</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{TITLES[mode]}</h2>
        <p className="mt-1 text-sm text-muted">
          {product.name} · currently <b>{product.stock}</b> {product.unit} in stock
        </p>

        <div className="mt-6 grid gap-4">
          <div>
            <label className={label}>
              {mode === "adjust" ? "Actual count on the shelf" : "Quantity"}
            </label>
            <input
              type="number"
              min={mode === "adjust" ? 0 : 1}
              className={field}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>
              {mode === "in" ? "Note (optional)" : "Reason"}
            </label>
            <input
              className={field}
              placeholder={
                mode === "in"
                  ? "e.g. Bought from supplier, bill no. 1042"
                  : mode === "out"
                    ? "e.g. Damaged, expired"
                    : "e.g. Monthly stock count"
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
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
            {busy ? "Saving..." : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}