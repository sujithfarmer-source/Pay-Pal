import { CheckCircle2, Clock3, RotateCcw, XCircle, Loader2 } from "lucide-react";
import type { PaymentView } from "./types";

const STYLES: Record<PaymentView["state"], { label: string; cls: string; Icon: typeof Clock3 }> = {
  initiated: { label: "Initiated", cls: "bg-mist text-ink-soft ring-line", Icon: Loader2 },
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-800 ring-amber-200", Icon: Clock3 },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200", Icon: CheckCircle2 },
  failed: { label: "Declined", cls: "bg-rose-50 text-rose-800 ring-rose-200", Icon: XCircle },
  refunded: { label: "Refunded", cls: "bg-violet-wash text-violet-deep ring-violet/25", Icon: RotateCcw },
};

export function StatusBadge({ state, delayed }: { state: PaymentView["state"]; delayed?: boolean }) {
  const s = STYLES[state];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}
      >
        <s.Icon className={`size-3.5 ${state === "initiated" ? "animate-spin" : ""}`} aria-hidden />
        {s.label}
      </span>
      {delayed && (
        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
          Delayed
        </span>
      )}
    </span>
  );
}
