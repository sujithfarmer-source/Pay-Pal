/**
 * Timeout monitor. There is no long-running worker on serverless, so a sweep
 * runs on every API read (the UI polls every 1.5s), on the manual tick
 * endpoint, and once a minute from a scheduled function as a backstop.
 *
 * Each due event is applied in the order it would have happened in real time:
 * a provider answer that arrives after the deadline is applied *after* the
 * timeout refund, so it gets voided.
 */
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { getDb, schema } from "../../../db";
import { applyProviderAnswer, findInFlight } from "./lifecycle";
import { refundForTimeout } from "./refund";
import { deadlineOf, isOverdue, type PaymentState } from "./state-machine";

export interface SweepResult {
  settled: number;
  refunded: number;
  voided: number;
}

export async function sweep(now: Date = new Date()): Promise<SweepResult> {
  const db = getDb();
  const result: SweepResult = { settled: 0, refunded: 0, voided: 0 };

  const due = await db
    .select({
      paymentId: schema.providerAuthorizations.paymentId,
      outcome: schema.providerAuthorizations.outcome,
      resolveAt: schema.providerAuthorizations.resolveAt,
      createdAt: schema.payments.createdAt,
      timeoutMs: schema.payments.timeoutMs,
    })
    .from(schema.providerAuthorizations)
    .innerJoin(schema.payments, eq(schema.payments.id, schema.providerAuthorizations.paymentId))
    .where(
      and(
        eq(schema.providerAuthorizations.status, "open"),
        isNotNull(schema.providerAuthorizations.resolveAt),
        lte(schema.providerAuthorizations.resolveAt, now),
      ),
    )
    .orderBy(schema.providerAuthorizations.resolveAt);

  for (const a of due) {
    if (a.outcome === "stall") continue;
    // The deadline came first in real time → the timeout refund wins.
    if (a.resolveAt && a.resolveAt.getTime() > deadlineOf(a).getTime()) {
      if ((await refundForTimeout(a.paymentId, now)) === "refunded") result.refunded++;
    }
    const r = await applyProviderAnswer(a.paymentId, a.outcome as "settle" | "decline");
    if (r === "applied") result.settled++;
    if (r === "voided") result.voided++;
  }

  for (const p of await findInFlight()) {
    if (isOverdue({ ...p, state: p.state as PaymentState }, now)) {
      if ((await refundForTimeout(p.id, now)) === "refunded") result.refunded++;
    }
  }
  return result;
}

/** Sweep, but never let a monitor hiccup break the read that triggered it. */
export async function sweepQuietly(): Promise<void> {
  try {
    await sweep();
  } catch (err) {
    console.error("[monitor] sweep failed", err);
  }
}
