/**
 * Refund service.
 *
 * refundForTimeout(): marks the payment delayed, claims the refund atomically
 * (in-flight states only — refunding a settled payment would wrongly debit the
 * recipient), voids the pending settlement, then writes exactly one ledger
 * row + one idempotent provider credit + one user notification.
 */
import { getDb, schema } from "../../../db";
import { claimTransition } from "./lifecycle";
import { IN_FLIGHT_STATES } from "./state-machine";
import { credit, voidAuthorization } from "./provider";
import { notify, recordEvent } from "./events";
import { formatInr } from "../simulation";

export const refundKeyFor = (paymentId: string) => `payment:${paymentId}:refund`;

export type RefundOutcome = "refunded" | "completed-first" | "already-final" | "not-found";

export async function refundForTimeout(paymentId: string, now = new Date()): Promise<RefundOutcome> {
  const db = getDb();

  // 1+2. Mark delayed and claim the refund in one atomic, conditional update —
  // only from in-flight states, so a settled payment is never touched.
  const claim = await claimTransition(paymentId, IN_FLIGHT_STATES, "refunded", {
    delayedAt: now,
    refundedAt: now,
  });
  if (!claim.ok) {
    if (claim.current === "completed") {
      await recordEvent(
        paymentId,
        "refund_suppressed",
        "Refund suppressed — the provider settled just before the time limit",
      );
      return "completed-first";
    }
    return claim.current === null ? "not-found" : "already-final";
  }
  const payment = claim.payment;
  const seconds = Math.round(payment.timeoutMs / 1000);
  await recordEvent(paymentId, "delayed", `Still pending after ${seconds}s — marked delayed`);

  // 3. Void the provider's pending settlement so a late answer cannot land.
  if (await voidAuthorization(paymentId)) {
    await recordEvent(paymentId, "settlement_voided", "Pending settlement voided with the provider");
  }

  // 4. One ledger row (primary key on refund key) + one idempotent provider credit.
  const refundKey = refundKeyFor(paymentId);
  const ledger = await db
    .insert(schema.refundLedger)
    .values({ refundKey, paymentId, amountCents: payment.amountCents, reason: "timeout" })
    .onConflictDoNothing()
    .returning({ key: schema.refundLedger.refundKey });
  if (ledger.length === 0) return "refunded"; // a refund record already exists; never write twice

  await credit(refundKey, paymentId, payment.amountCents);
  await recordEvent(
    paymentId,
    "refunded",
    `Auto-refunded ${formatInr(payment.amountCents)} to your account`,
    { refundKey },
  );
  await notify(
    paymentId,
    "refunded",
    "Refund issued automatically",
    `${formatInr(payment.amountCents)} to ${payment.payeeName} was stuck for ${seconds}s, so we refunded it. No action needed.`,
  );
  return "refunded";
}
