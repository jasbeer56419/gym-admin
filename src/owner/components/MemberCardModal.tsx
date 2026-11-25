import { Printer, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Member } from "../../types";
import { fmtDate } from "../utils";

type Props = {
  member: Member;
  businessName: string;
  onClose: () => void;
};

export default function MemberCardModal({ member, businessName, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm print:hidden"
        onClick={onClose}
      />

      <div className="relative my-8 w-full max-w-md">
        <div className="mb-3 flex justify-end gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="btn-gold flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <Printer size={16} /> Print Card
          </button>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white text-muted hover:text-charcoal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Only this part is printed */}
        <div className="print-area">
          <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d1a26] to-[#0f0d15] p-7 text-white shadow-2xl [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-lg font-semibold text-gold-light">
                  {businessName}
                </p>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                  Member Card
                </p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-gold-light to-gold font-display text-lg font-semibold text-charcoal">
                {businessName[0]?.toUpperCase()}
              </div>
            </div>

            <div className="mt-8 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-display text-2xl font-semibold">{member.name}</p>
                <p className="mt-1 text-sm tracking-widest text-gold-light">{member.code}</p>

                <div className="mt-5 space-y-1 text-xs text-white/60">
                  <p>
                    Plan: <span className="text-white">{member.membershipPlan || "—"}</span>
                  </p>
                  <p>
                    Valid until:{" "}
                    <span className="text-white">
                      {member.membershipEnd ? fmtDate(member.membershipEnd) : "—"}
                    </span>
                  </p>
                  <p>
                    Home branch: <span className="text-white">{member.branchName || "—"}</span>
                  </p>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl bg-white p-2.5">
                <QRCodeSVG value={member.code} size={104} level="M" />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-white/80 print:hidden">
          Scan this QR code at the front desk to check the member in instantly.
        </p>
      </div>
    </div>
  );
}