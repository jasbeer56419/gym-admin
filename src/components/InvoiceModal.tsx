import { Dumbbell, Printer, X } from "lucide-react";
import type { Payment } from "../types";

type Props = {
  payment: Payment;
  onClose: () => void;
};

const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const fmtDate = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const stamp: Record<string, string> = {
  paid: "border-emerald-600 text-emerald-700",
  pending: "border-amber-500 text-amber-600",
  failed: "border-red-600 text-red-600",
  refunded: "border-slate-500 text-slate-600",
};

export default function InvoiceModal({ payment: p, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm print:hidden"
        onClick={onClose}
      />

      <div className="relative my-8 w-full max-w-2xl">
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <Printer size={16} /> Print / Save PDF
          </button>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white text-muted hover:text-charcoal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Only this part is printed */}
        <div className="print-area overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] px-10 py-8 text-white">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-gold-light to-gold text-charcoal">
                <Dumbbell size={20} strokeWidth={2.2} />
              </div>
              <div>
                <p className="font-display text-xl font-semibold text-gold-light">GYMOS</p>
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">
                  Platform Control
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light">
                Invoice
              </p>
              <p className="font-display text-2xl font-semibold">{p.invoiceNo}</p>
            </div>
          </div>

          <div className="px-10 py-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted">Bill To</p>
                <p className="mt-1 text-lg font-semibold">{p.businessName}</p>
                <p className="text-sm text-muted">{p.ownerName}</p>
                <p className="text-sm text-muted">{p.ownerEmail}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wider text-muted">Date</p>
                <p className="mt-1 font-medium">{fmtDate(p.date)}</p>
                <span
                  className={`mt-3 inline-block -rotate-3 rounded-lg border-2 px-4 py-1 text-sm font-bold uppercase tracking-widest ${
                    stamp[p.status]
                  }`}
                >
                  {p.status}
                </span>
              </div>
            </div>

            <table className="mt-8 w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-gold/40 text-xs uppercase tracking-wider text-muted">
                  <th className="py-3 font-medium">Description</th>
                  <th className="py-3 font-medium">Cycle</th>
                  <th className="py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-4">
                    <p className="font-medium">{p.plan} Plan Subscription</p>
                    <p className="text-xs text-muted">GYMOS Gym Management Platform</p>
                  </td>
                  <td className="py-4 capitalize">{p.cycle}</td>
                  <td className="py-4 text-right font-medium">{rupee(p.amount)}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-6 flex justify-end">
              <div className="w-64 rounded-2xl bg-gold/10 p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">Total</span>
                  <span className="font-display text-3xl font-semibold">
                    {rupee(p.amount)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">Paid via {p.method}</p>
              </div>
            </div>

            {p.note && (
              <p className="mt-6 text-sm text-muted">
                <b className="text-charcoal">Note:</b> {p.note}
              </p>
            )}

            <p className="mt-10 border-t border-line pt-5 text-center text-xs text-muted">
              This is a computer-generated invoice. Thank you!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
