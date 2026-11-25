import { Printer, X } from "lucide-react";
import type { BusinessSettings, MemberPayment } from "../../types";
import { fmtDate, rupee } from "../utils";

type Props = {
  payment: MemberPayment;
  settings: BusinessSettings;
  businessName: string;
  onClose: () => void;
};

const money = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReceiptModal({ payment: p, settings, businessName, onClose }: Props) {
  const refunded = p.refundedAmount ?? 0;
  const showGst = settings.showGst && settings.gstRate > 0;

  // Prices include GST, so split the paid amount into taxable value and tax
  const taxable = showGst ? p.amount / (1 + settings.gstRate / 100) : p.amount;
  const tax = p.amount - taxable;

  const addressLine = [settings.address, settings.city, [settings.state, settings.pincode].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  const description =
    p.type === "due" ? `Balance payment · ${p.planName}` : `${p.planName} membership`;

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
          <div className="flex flex-wrap items-start justify-between gap-4 bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] px-10 py-8 text-white">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-light to-gold font-display text-xl font-semibold text-charcoal">
                {businessName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-display text-xl font-semibold text-gold-light">
                  {businessName}
                </p>
                {addressLine && <p className="mt-1 text-xs text-white/60">{addressLine}</p>}
                {(settings.phone || settings.email) && (
                  <p className="text-xs text-white/60">
                    {[settings.phone, settings.email].filter(Boolean).join(" · ")}
                  </p>
                )}
                {settings.gstin && (
                  <p className="text-xs text-white/60">GSTIN: {settings.gstin}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.3em] text-gold-light">Receipt</p>
              <p className="font-display text-2xl font-semibold">{p.invoiceNo}</p>
              <p className="mt-1 text-xs text-white/60">{fmtDate(p.date)}</p>
            </div>
          </div>

          <div className="px-10 py-8">
            <p className="text-[11px] uppercase tracking-wider text-muted">Received from</p>
            <p className="mt-1 text-lg font-semibold">{p.memberName}</p>
            {p.collectedByName && (
  <p className="mt-1 text-xs text-muted">Collected by {p.collectedByName}</p>
)}

            <table className="mt-8 w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-gold/40 text-xs uppercase tracking-wider text-muted">
                  <th className="py-3 font-medium">Description</th>
                  <th className="py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-4">
                    <p className="font-medium">{description}</p>
                    <p className="text-xs text-muted">Paid via {p.method}</p>
                  </td>
                  <td className="py-4 text-right font-medium">₹{money(taxable)}</td>
                </tr>
                {showGst && (
                  <>
                    <tr className="border-b border-line text-muted">
                      <td className="py-2.5">CGST @ {settings.gstRate / 2}%</td>
                      <td className="py-2.5 text-right">₹{money(tax / 2)}</td>
                    </tr>
                    <tr className="border-b border-line text-muted">
                      <td className="py-2.5">SGST @ {settings.gstRate / 2}%</td>
                      <td className="py-2.5 text-right">₹{money(tax / 2)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            <div className="mt-6 flex justify-end">
              <div className="w-72 rounded-2xl bg-gold/10 p-5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted">Amount paid</span>
                  <span className="font-display text-3xl font-semibold">
                    {rupee(p.amount)}
                  </span>
                </div>
                {refunded > 0 && (
                  <>
                    <div className="mt-2 flex justify-between text-sm text-red-600">
                      <span>Refunded</span>
                      <span>- {rupee(refunded)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm font-medium">
                      <span>Net amount</span>
                      <span>{rupee(p.amount - refunded)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {p.note && (
              <p className="mt-6 text-sm text-muted">
                <b className="text-charcoal">Note:</b> {p.note}
              </p>
            )}

            <p className="mt-10 border-t border-line pt-5 text-center text-xs text-muted">
              {settings.receiptNote || "This is a computer-generated receipt."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}