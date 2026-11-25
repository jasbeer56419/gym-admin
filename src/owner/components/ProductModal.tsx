import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Product, ProductInput, Supplier } from "../inventoryTypes";

const CATEGORIES = ["Supplements", "Beverages", "Snacks", "Merchandise", "Accessories", "Other"];
const UNITS = ["pcs", "bottle", "pack", "box", "kg", "sachet"];

type Props = {
  product: Product | null; // null = add a new product
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (data: ProductInput, openingStock: number) => Promise<void>;
};

const field = "input-lux !pl-4";
const label = "mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted";

export default function ProductModal({ product, suppliers, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: product?.category ?? "Supplements",
    sku: product?.sku ?? "",
    unit: product?.unit ?? "pcs",
    costPrice: product?.costPrice ?? 0,
    sellPrice: product?.sellPrice ?? 0,
    lowStockAt: product?.lowStockAt ?? 5,
    supplierId: product?.supplierId ?? "",
    status: (product?.status ?? "active") as "active" | "inactive",
    openingStock: 0,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.costPrice < 0 || form.sellPrice < 0) {
      setError("Prices cannot be negative.");
      return;
    }
    if (form.lowStockAt < 0 || !Number.isInteger(form.lowStockAt)) {
      setError("The low stock alert must be a whole number, 0 or more.");
      return;
    }
    if (!product && (form.openingStock < 0 || !Number.isInteger(form.openingStock))) {
      setError("The opening stock must be a whole number, 0 or more.");
      return;
    }

    setBusy(true);
    try {
      await onSave(
        {
          name: form.name.trim(),
          category: form.category.trim(),
          sku: form.sku.trim(),
          unit: form.unit.trim() || "pcs",
          costPrice: form.costPrice,
          sellPrice: form.sellPrice,
          lowStockAt: form.lowStockAt,
          supplierId: form.supplierId,
          status: form.status,
        },
        form.openingStock
      );
      onClose();
    } catch {
      setError("Could not save. Please check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="card relative my-8 w-full max-w-2xl !bg-white p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-muted hover:text-charcoal"
        >
          <X size={20} />
        </button>

        <p className="text-xs uppercase tracking-[0.3em] text-gold-soft">
          {product ? "Edit" : "New"} Product
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          {product ? "Update Product" : "Add a Product"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Product Name</label>
            <input
              className={field}
              placeholder="e.g. Whey Protein 1 kg"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div>
            <label className={label}>Category</label>
            <input
              className={field}
              list="product-categories"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            />
            <datalist id="product-categories">
              {CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={label}>SKU / Code (optional)</label>
            <input
              className={field}
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Cost Price (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.costPrice}
              onChange={(e) => set("costPrice", Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Selling Price (₹)</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.sellPrice}
              onChange={(e) => set("sellPrice", Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className={label}>Unit</label>
            <input
              className={field}
              list="product-units"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
            />
            <datalist id="product-units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={label}>Low Stock Alert At</label>
            <input
              type="number"
              min={0}
              className={field}
              value={form.lowStockAt}
              onChange={(e) => set("lowStockAt", Number(e.target.value))}
            />
          </div>

          <div>
            <label className={label}>Supplier</label>
            <select
              className={field}
              value={form.supplierId}
              onChange={(e) => set("supplierId", e.target.value)}
            >
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={label}>Status</label>
            <select
              className={field}
              value={form.status}
              onChange={(e) => set("status", e.target.value as "active" | "inactive")}
            >
              <option value="active">Active (can be sold)</option>
              <option value="inactive">Inactive (hidden)</option>
            </select>
          </div>

          {!product && (
            <div className="sm:col-span-2">
              <label className={label}>Opening Stock</label>
              <input
                type="number"
                min={0}
                className={field}
                value={form.openingStock}
                onChange={(e) => set("openingStock", Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-muted">
                How many you already have right now. Later, use Add stock, Remove or Correct count
                on the product row.
              </p>
            </div>
          )}
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
            {busy ? "Saving..." : product ? "Update Product" : "Add Product"}
          </button>
        </div>
      </form>
    </div>
  );
}