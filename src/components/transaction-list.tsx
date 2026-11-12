"use client";

import { formatInr } from "@/lib/simulation";
import { describeNetwork } from "@/lib/network-detect";
import { StatusBadge } from "./status-badge";
import { useNow } from "./use-network";
import type { PaymentView } from "./types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Countdown({ deadline, skew }: { deadline: string; skew: number }) {
  const now = useNow();
  const left = Math.max(0, new Date(deadline).getTime() - (now + skew));
  return (
    <span className="font-mono text-xs text-amber-700 tabular-nums">
      {left > 0 ? `refund in ${(left / 1000).toFixed(1)}s` : "refunding…"}
    </span>
  );
}

export function TransactionList({
  payments,
  loading,
  skew,
  onSelect,
  onNew,
}: {
  payments: PaymentView[];
  loading: boolean;
  skew: number;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  if (loading) {
    return (
      <ul className="divide-y divide-line">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-4 py-4">
            <div className="skeleton size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3.5 w-1/3 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
            <div className="skeleton h-4 w-20 rounded" />
          </li>
        ))}
      </ul>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line px-6 py-14 text-center">
        <p className="font-display text-xl font-semibold">No payments yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
          Send your first payment. Every transfer is watched, and anything stuck past 10 seconds is refunded
          automatically.
        </p>
        <button
          onClick={onNew}
          className="mt-5 rounded-full bg-violet px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-deep"
        >
          Send a payment
        </button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {payments.map((p, i) => {
        const inFlight = p.state === "pending" || p.state === "initiated";
        return (
          <li key={p.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
            <button
              onClick={() => onSelect(p.id)}
              className="group -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-4 rounded-2xl px-3 py-4 text-left transition hover:bg-mist focus-visible:ring-2 focus-visible:ring-violet focus-visible:outline-none"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-wash text-sm font-semibold text-violet-deep">
                {initials(p.payeeName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{p.payeeName}</span>
                  <StatusBadge state={p.state} delayed={p.delayed} />
                </span>
                <span className="mt-0.5 block truncate text-xs text-ink-faint">
                  {new Date(p.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  {p.network ? ` · ${describeNetwork(p.network)}` : ""}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                {inFlight && <Countdown deadline={p.deadline} skew={skew} />}
              </span>
              <span
                className={`font-display text-lg font-semibold tabular-nums ${
                  p.state === "refunded" || p.state === "failed" ? "text-ink-faint line-through decoration-1" : ""
                }`}
              >
                −{formatInr(p.amountCents)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
