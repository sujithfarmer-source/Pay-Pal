"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatInr } from "@/lib/simulation";
import { NetworkBanner, NetworkChip } from "./network";
import { NewPaymentDialog } from "./new-payment-dialog";
import { NotificationsBell } from "./notifications-bell";
import { StatusBadge } from "./status-badge";
import { TransactionList } from "./transaction-list";
import { useNetwork } from "./use-network";
import type { NotificationView, PaymentDetail, PaymentView, Stats } from "./types";

export function Dashboard() {
  const network = useNetwork();
  const [payments, setPayments] = useState<PaymentView[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [notes, setNotes] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [skew, setSkew] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, n] = await Promise.all([
        fetch("/api/payments", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/notifications", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setPayments(p.payments ?? []);
      setStats(p.stats ?? null);
      if (p.serverTime) setSkew(new Date(p.serverTime).getTime() - Date.now());
      setNotes(n.notifications ?? []);
    } catch {
      /* keep last state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!selected) return setDetail(null);
    let alive = true;
    const get = () =>
      fetch(`/api/payments/${selected}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && setDetail(d));
    void get();
    const t = setInterval(get, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [selected]);

  const onBell = useCallback((open: boolean) => {
    if (!open) void fetch("/api/notifications", { method: "POST" });
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <header className="flex items-center justify-between gap-3">
        <span className="font-display text-2xl font-bold tracking-tight">
          Go<span className="text-violet">Pay</span>
        </span>
        <div className="flex items-center gap-2">
          <NetworkChip network={network} />
          <NotificationsBell
            items={notes}
            unread={notes.filter((n) => !n.read).length}
            onOpenChange={onBell}
            onSelect={setSelected}
          />
        </div>
      </header>

      <section className="mt-10">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Payments that never get stuck.
        </h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Every transfer is watched. If it stays pending past 10 seconds it is marked delayed and refunded
          automatically.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            ["Sent", formatInr(stats?.sentCents ?? 0)],
            ["Auto-refunded", formatInr(stats?.refundedCents ?? 0)],
            ["In flight", String(stats?.inFlight ?? 0)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line p-4">
              <p className="text-xs text-ink-faint uppercase">{k}</p>
              <p className="font-display mt-1 text-xl font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6">
        <NetworkBanner network={network} />
      </div>

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Activity</h2>
          <button
            onClick={() => setDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white hover:bg-violet-deep"
          >
            <Plus className="size-4" /> New payment
          </button>
        </div>
        <TransactionList
          payments={payments}
          loading={loading}
          skew={skew}
          onSelect={setSelected}
          onNew={() => setDialog(true)}
        />
      </section>

      <NewPaymentDialog
        open={dialog}
        network={network}
        onClose={() => setDialog(false)}
        onCreated={(p) => {
          setDialog(false);
          setSelected(p.id);
          void load();
        }}
      />

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={() => setSelected(null)}>
          <aside
            onClick={(e) => e.stopPropagation()}
            className="animate-slide-in h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-display text-2xl font-semibold">Payment details</h2>
              <button onClick={() => setSelected(null)} aria-label="Close" className="rounded-full p-2 hover:bg-mist">
                <X className="size-4" />
              </button>
            </div>
            {!detail ? (
              <div className="skeleton mt-6 h-40 rounded-2xl" />
            ) : (
              <>
                <p className="font-display mt-4 text-4xl font-semibold">{formatInr(detail.payment.amountCents)}</p>
                <p className="text-ink-soft">
                  to {detail.payment.payeeName} · {detail.payment.payeeHandle}
                </p>
                <div className="mt-3">
                  <StatusBadge state={detail.payment.state} delayed={detail.payment.delayed} />
                </div>
                {detail.refund && (
                  <p className="mt-3 rounded-xl bg-violet-wash p-3 text-sm text-violet-deep">
                    Refunded {formatInr(detail.refund.amountCents)} · key {detail.refund.refundKey}
                  </p>
                )}
                <h3 className="mt-6 text-sm font-semibold text-ink-faint uppercase">Timeline</h3>
                <ol className="mt-2 space-y-3 border-l border-line pl-4">
                  {detail.events.map((e) => (
                    <li key={e.id} className="text-sm">
                      <p className="font-medium">{e.message}</p>
                      <p className="text-xs text-ink-faint">
                        {new Date(e.createdAt).toLocaleTimeString("en-IN")}
                      </p>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
