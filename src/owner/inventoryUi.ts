import type { EquipmentStatus, StockMode } from "./inventoryTypes";

export const EQUIP_STATUS: Record<EquipmentStatus, { label: string; cls: string }> = {
  working: { label: "Working", cls: "bg-emerald-500/10 text-emerald-700" },
  maintenance: { label: "Under maintenance", cls: "bg-amber-500/10 text-amber-700" },
  out_of_order: { label: "Out of order", cls: "bg-red-500/10 text-red-700" },
  retired: { label: "Retired", cls: "bg-slate-500/10 text-slate-600" },
};

export const MOVE_STYLE: Record<StockMode, { label: string; cls: string }> = {
  in: { label: "Stock in", cls: "bg-emerald-500/10 text-emerald-700" },
  out: { label: "Stock out", cls: "bg-amber-500/10 text-amber-700" },
  sale: { label: "Sale", cls: "bg-sky-500/10 text-sky-700" },
  adjust: { label: "Correction", cls: "bg-violet-500/10 text-violet-700" },
};

export const whenOf = (ts?: { toDate: () => Date } | null) =>
  ts
    ? ts.toDate().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "just now";