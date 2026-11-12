/**
 * Simulated payment service provider (PSP). No real money moves.
 *
 * Authorizations decide their outcome up front (settle / decline / stall) and
 * record when the provider will answer. The monitor applies due answers, so the
 * simulation works across stateless serverless invocations.
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "../../../db";
import type { Scenario } from "../simulation";

export type ProviderOutcome = "settle" | "decline" | "stall";

export interface AuthorizationPlan {
  outcome: ProviderOutcome;
  /** Delay before the provider answers; null = never answers. */
  delayMs: number | null;
}

const between = (min: number, max: number, rnd: () => number) =>
  Math.round(min + (max - min) * rnd());

/** Pure: how the provider will behave for a given scenario. */
export function planAuthorization(
  scenario: Scenario,
  timeoutMs: number,
  rnd: () => number = Math.random,
): AuthorizationPlan {
  switch (scenario) {
    case "instant":
      return { outcome: "settle", delayMs: between(250, 900, rnd) };
    case "realistic":
      return rnd() < 0.12
        ? { outcome: "decline", delayMs: between(800, 2500, rnd) }
        : { outcome: "settle", delayMs: between(1000, 4000, rnd) };
    case "slow":
      // Answers only after the pending window has elapsed.
      return { outcome: "settle", delayMs: timeoutMs + between(1500, 6000, rnd) };
    case "stalled":
      return { outcome: "stall", delayMs: null };
  }
}

export async function authorize(paymentId: string, plan: AuthorizationPlan, now = new Date()) {
  await getDb()
    .insert(schema.providerAuthorizations)
    .values({
      paymentId,
      outcome: plan.outcome,
      resolveAt: plan.delayMs === null ? null : new Date(now.getTime() + plan.delayMs),
    })
    .onConflictDoNothing();
}

/**
 * Atomically take an open authorization so exactly one worker applies it.
 * Returns false if it was already resolved or voided.
 */
export async function claimAuthorization(paymentId: string): Promise<boolean> {
  const rows = await getDb()
    .update(schema.providerAuthorizations)
    .set({ status: "resolved" })
    .where(
      and(
        eq(schema.providerAuthorizations.paymentId, paymentId),
        eq(schema.providerAuthorizations.status, "open"),
      ),
    )
    .returning({ id: schema.providerAuthorizations.paymentId });
  return rows.length === 1;
}

/** Cancel an open authorization (used when a timeout refund wins). */
export async function voidAuthorization(paymentId: string): Promise<boolean> {
  const rows = await getDb()
    .update(schema.providerAuthorizations)
    .set({ status: "voided" })
    .where(
      and(
        eq(schema.providerAuthorizations.paymentId, paymentId),
        eq(schema.providerAuthorizations.status, "open"),
      ),
    )
    .returning({ id: schema.providerAuthorizations.paymentId });
  return rows.length === 1;
}

/**
 * Idempotent refund credit keyed by refund key: the money movement itself can
 * never repeat. Returns true only for the call that actually moved money.
 */
export async function credit(refundKey: string, paymentId: string, amountCents: number) {
  const rows = await getDb()
    .insert(schema.providerCredits)
    .values({ refundKey, paymentId, amountCents })
    .onConflictDoNothing()
    .returning({ key: schema.providerCredits.refundKey });
  return rows.length === 1;
}
