"use client";

import { X, ArrowUpRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NetworkSnapshot } from "@/lib/simulation";
import { NetworkDetectionCard } from "./network";
import type { PaymentView } from "./types";

const CONTACTS = [
  { name: "Priya Sharma", handle: "priya@okgopay" },
  { name: "Arjun Mehta", handle: "arjun.m@okgopay" },
  { name: "Chai Point", handle: "chaipoint@merchant" },
  { name: "Meera Iyer", handle: "meera.iyer@okgopay" },
];

export function NewPaymentDialog({
  open,
  network,
  onClose,
  onCreated,
}: {
  open: boolean;
  network: NetworkSnapshot | null;
  onClose: () => void;
  onCreated: (p: PaymentView) => void;
}) {
  const [payeeName, setPayeeName] = useState("");
  const [payeeHandle, setPayeeHandle] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per dialog session: double-clicks and retries reuse it.
  const keyRef = useRef<string>("");
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      keyRef.current = crypto.randomUUID();
      setError(null);
      setTimeout(() => firstField.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const rupees = Number(amount.replace(/,/g, ""));
    if (!payeeName.trim()) return setError("Choose or enter who you're paying.");
    if (!Number.isFinite(rupees) || rupees < 1) return setError("Enter an amount of at least ₹1.");
    if (rupees > 100000) return setError("The demo limit is ₹1,00,000 per payment.");
    setBusy(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": keyRef.current },
        body: JSON.stringify({
          payeeName,
          payeeHandle,
          amountCents: Math.round(rupees * 100),
          note,
          network,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed to send");
      setPayeeName("");
      setPayeeHandle("");
      setAmount("");
      setNote("");
      onCreated(data.payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed to send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-ink/30 backdrop-blur-[2px] sm:place-items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-payment-title"
        className="animate-pop w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="new-payment-title" className="font-display text-2xl font-semibold tracking-tight">
              Send money
            </h2>
            <p className="text-sm text-ink-soft">Auto-refunded if it&apos;s still pending after 10s.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-ink-faint hover:bg-mist hover:text-ink">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {CONTACTS.map((c) => (
            <button
              type="button"
              key={c.handle}
              onClick={() => {
                setPayeeName(c.name);
                setPayeeHandle(c.handle);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                payeeHandle === c.handle
                  ? "border-violet bg-violet-wash text-violet-deep"
                  : "border-line text-ink-soft hover:border-violet/40"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium">
          To
          <input
            ref={firstField}
            value={payeeName}
            onChange={(e) => {
              setPayeeName(e.target.value);
              setPayeeHandle("");
            }}
            placeholder="Name"
            maxLength={80}
            className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-violet focus:ring-3 focus:ring-violet/15"
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Amount
          <div className="mt-1 flex items-center rounded-xl border border-line px-3 focus-within:border-violet focus-within:ring-3 focus-within:ring-violet/15">
            <span className="font-display text-2xl text-ink-faint">₹</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              inputMode="decimal"
              placeholder="0.00"
              className="font-display w-full bg-transparent px-2 py-2 text-3xl font-semibold tracking-tight outline-none"
            />
          </div>
        </label>

        <label className="mt-4 block text-sm font-medium">
          Note <span className="font-normal text-ink-faint">(optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            placeholder="Dinner, rent, chai…"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-violet focus:ring-3 focus:ring-violet/15"
          />
        </label>

        <div className="mt-4">
          <NetworkDetectionCard network={network} />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-violet px-5 py-3.5 font-semibold text-white transition hover:bg-violet-deep active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpRight className="size-4" />}
          {busy ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
