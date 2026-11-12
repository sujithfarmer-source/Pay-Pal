/**
 * Atomic state claims + settlement/failure handling.
 *
 * claimTransition() reads the row, checks the state machine, then performs a
 * conditional `UPDATE ... WHERE state = <seen>`. If two racers saw the same
 * state, only the first UPDATE matches a row; the loser re-reads and retries
 * against the new state, which the state machine usually forbids.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "../../../db";
import { canTransition, type PaymentState } from "./state-machine";
import { claimAuthorization } from "./provider";
import { notify, recordEvent } from "./events";
import { formatInr } from "../simulation";

export type Payment = typeof schema.payments.$inferSelect;

export type ClaimResult =
  | { ok: true; from: PaymentState; payment: Payment }
  | { ok: false; current: PaymentState | null };

export async function claimTransition(
  paymentId: string,
  allowedFrom: readonly PaymentState[],
  to: PaymentState,
  patch: Partial<typeof schema.payments.$inferInsert> = {},
): Promise<ClaimResult> {
  const db = getDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    const [row] = await db
      .select({ state: schema.payments.state })
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId));
    if (!row) return { ok: false, current: null };
    const seen = row.state as PaymentState;
    if (!allowedFrom.includes(seen) || !canTransition(seen, to)) {
      return { ok: false, current: seen };
    }
    const updated = await db
      .update(schema.payments)
      .set({ ...patch, state: to, updatedAt: new Date() })
      .where(and(eq(schema.payments.id, paymentId), eq(schema.payments.state, seen)))
      .returning();
    if (updated.length === 1) return { ok: true, from: seen, payment: updated[0] };
    // Lost the race: someone else changed the state between read and update. Re-read.
  }
  const [row] = await db
    .select({ state: schema.payments.state })
    .from(schema.payments)
    .where(eq(schema.payments.id, paymentId));
  return { ok: false, current: (row?.state as PaymentState) ?? null };
}

/** Apply the provider's (possibly late) answer for one payment. */
export async function applyProviderAnswer(
  paymentId: string,
  outcome: "settle" | "decline",
): Promise<"applied" | "voided" | "skipped"> {
  if (!(await claimAuthorization(paymentId))) return "skipped";

  if (outcome === "settle") {
    const res = await claimTransition(paymentId, ["pending"], "completed", { settledAt: new Date() });
    if (res.ok) {
      await recordEvent(paymentId, "completed", "Provider settled the payment");
      await notify(
        paymentId,
        "completed",
        "Payment sent",
        `${formatInr(res.payment.amountCents)} to ${res.payment.payeeName} went through.`,
      );
      return "applied";
    }
    await recordEvent(
      paymentId,
      "late_settlement_voided",
      `Late settlement voided — payment was already ${res.current ?? "gone"}`,
      { current: res.current },
    );
    return "voided";
  }

  const res = await claimTransition(paymentId, ["pending"], "failed", {
    failureReason: "Declined by provider",
  });
  if (res.ok) {
    await recordEvent(paymentId, "failed", "Provider declined the payment — no money moved");
    await notify(
      paymentId,
      "failed",
      "Payment declined",
      `${formatInr(res.payment.amountCents)} to ${res.payment.payeeName} was declined. You were not charged.`,
    );
    return "applied";
  }
  await recordEvent(paymentId, "late_decline_ignored", "Late decline ignored", { current: res.current });
  return "voided";
}

export async function findPayment(paymentId: string): Promise<Payment | undefined> {
  const [row] = await getDb().select().from(schema.payments).where(eq(schema.payments.id, paymentId));
  return row;
}

export async function findInFlight(): Promise<Payment[]> {
  return getDb()
    .select()
    .from(schema.payments)
    .where(inArray(schema.payments.state, ["initiated", "pending"]));
}
