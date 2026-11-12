/**
 * Orchestration: idempotent payment creation, provider handoff, API read
 * models and device-network annotations.
 */
import { asc, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../../../db";
import { claimTransition, findPayment, type Payment } from "./lifecycle";
import { authorize, planAuthorization } from "./provider";
import { notify, recordEvent } from "./events";
import { deadlineOf } from "./state-machine";
import {
  DEFAULT_TIMEOUT_MS,
  SCENARIO_LABELS,
  formatInr,
  isScenario,
  type NetworkSnapshot,
  type Scenario,
} from "../simulation";
import { describeNetwork, scenarioForNetwork } from "../network-detect";

export interface CreatePaymentInput {
  idempotencyKey: string;
  payeeName: string;
  payeeHandle: string;
  amountCents: number;
  note?: string;
  scenario?: string;
  network?: NetworkSnapshot | null;
  timeoutMs?: number;
}

export class ValidationError extends Error {}

export function validateCreate(input: Partial<CreatePaymentInput>): CreatePaymentInput {
  const key = String(input.idempotencyKey ?? "").trim();
  if (key.length < 8 || key.length > 200) throw new ValidationError("A valid Idempotency-Key is required");
  const payeeName = String(input.payeeName ?? "").trim();
  if (!payeeName || payeeName.length > 80) throw new ValidationError("Enter who you are paying");
  const payeeHandle = String(input.payeeHandle ?? "").trim() || `${payeeName.toLowerCase().replace(/\s+/g, ".")}@gopay`;
  const amountCents = Number(input.amountCents);
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 10_000_000) {
    throw new ValidationError("Amount must be between ₹1 and ₹1,00,000");
  }
  if (input.scenario !== undefined && !isScenario(input.scenario)) {
    throw new ValidationError("Unknown scenario");
  }
  const timeoutMs = input.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : Number(input.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 2_000 || timeoutMs > 120_000) {
    throw new ValidationError("timeoutMs must be between 2000 and 120000");
  }
  return {
    idempotencyKey: key,
    payeeName,
    payeeHandle: payeeHandle.slice(0, 80),
    amountCents,
    note: String(input.note ?? "").slice(0, 140),
    scenario: input.scenario,
    network: input.network ?? null,
    timeoutMs,
  };
}

export async function createPayment(
  raw: Partial<CreatePaymentInput>,
): Promise<{ payment: Payment; created: boolean }> {
  const input = validateCreate(raw);
  const network = input.network ?? null;
  const scenario: Scenario = isScenario(input.scenario)
    ? input.scenario
    : scenarioForNetwork(network?.quality ?? "unknown");

  const db = getDb();
  const inserted = await db
    .insert(schema.payments)
    .values({
      idempotencyKey: input.idempotencyKey,
      payeeName: input.payeeName,
      payeeHandle: input.payeeHandle,
      note: input.note ?? "",
      amountCents: input.amountCents,
      scenario,
      network,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    })
    .onConflictDoNothing({ target: schema.payments.idempotencyKey })
    .returning();

  if (inserted.length === 0) {
    // Retry / double-click: hand back the original payment, never charge twice.
    const [existing] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.idempotencyKey, input.idempotencyKey));
    return { payment: existing, created: false };
  }

  const payment = inserted[0];
  await recordEvent(
    payment.id,
    "initiated",
    `Payment of ${formatInr(payment.amountCents)} to ${payment.payeeName} initiated`,
  );
  if (network) {
    await recordEvent(payment.id, "network_detected", `Device network detected: ${describeNetwork(network)}`, {
      ...network,
      scenario,
    });
  }

  // Provider handoff.
  const plan = planAuthorization(scenario, payment.timeoutMs);
  await authorize(payment.id, plan, payment.createdAt);
  const res = await claimTransition(payment.id, ["initiated"], "pending");
  await recordEvent(
    payment.id,
    "pending",
    `Sent to provider — ${SCENARIO_LABELS[scenario].label.toLowerCase()}; auto-refund in ${Math.round(payment.timeoutMs / 1000)}s if not settled`,
  );
  await notify(
    payment.id,
    "initiated",
    "Payment on its way",
    `${formatInr(payment.amountCents)} to ${payment.payeeName} is processing. If it gets stuck, we'll refund it automatically.`,
  );
  return { payment: res.ok ? res.payment : ((await findPayment(payment.id)) ?? payment), created: true };
}

export function toView(p: Payment) {
  return {
    id: p.id,
    payeeName: p.payeeName,
    payeeHandle: p.payeeHandle,
    note: p.note,
    amountCents: p.amountCents,
    currency: p.currency,
    state: p.state,
    delayed: p.delayedAt !== null,
    scenario: p.scenario,
    network: p.network as NetworkSnapshot | null,
    timeoutMs: p.timeoutMs,
    deadline: deadlineOf(p).toISOString(),
    createdAt: p.createdAt.toISOString(),
    settledAt: p.settledAt?.toISOString() ?? null,
    refundedAt: p.refundedAt?.toISOString() ?? null,
    failureReason: p.failureReason,
  };
}
export type PaymentView = ReturnType<typeof toView>;

export async function listPayments(limit = 50) {
  const rows = await getDb()
    .select()
    .from(schema.payments)
    .orderBy(desc(schema.payments.createdAt))
    .limit(limit);
  return rows.map(toView);
}

export async function getStats() {
  const [row] = await getDb()
    .select({
      total: sql<number>`count(*)::int`,
      sentCents: sql<number>`coalesce(sum(case when ${schema.payments.state} = 'completed' then ${schema.payments.amountCents} end), 0)::int`,
      refundedCents: sql<number>`coalesce(sum(case when ${schema.payments.state} = 'refunded' then ${schema.payments.amountCents} end), 0)::int`,
      refundedCount: sql<number>`count(*) filter (where ${schema.payments.state} = 'refunded')::int`,
      inFlight: sql<number>`count(*) filter (where ${schema.payments.state} in ('initiated','pending'))::int`,
    })
    .from(schema.payments);
  return row;
}

export async function getPaymentDetail(id: string) {
  const p = await findPayment(id);
  if (!p) return null;
  const db = getDb();
  const events = await db
    .select()
    .from(schema.paymentEvents)
    .where(eq(schema.paymentEvents.paymentId, id))
    .orderBy(asc(schema.paymentEvents.createdAt), asc(schema.paymentEvents.id));
  const [refund] = await db.select().from(schema.refundLedger).where(eq(schema.refundLedger.paymentId, id));
  return {
    payment: toView(p),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    })),
    refund: refund
      ? { refundKey: refund.refundKey, amountCents: refund.amountCents, createdAt: refund.createdAt.toISOString() }
      : null,
  };
}
export type PaymentDetail = NonNullable<Awaited<ReturnType<typeof getPaymentDetail>>>;

export async function listNotifications(limit = 30) {
  const rows = await getDb()
    .select()
    .from(schema.notifications)
    .orderBy(desc(schema.notifications.createdAt), desc(schema.notifications.id))
    .limit(limit);
  return rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }));
}

export async function markAllNotificationsRead() {
  await getDb().update(schema.notifications).set({ read: true }).where(eq(schema.notifications.read, false));
}
