import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** One row per transfer. `state` follows the 5-state machine in src/lib/payments/state-machine.ts. */
export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    payeeName: text("payee_name").notNull(),
    payeeHandle: text("payee_handle").notNull(),
    note: text().notNull().default(""),
    /** Integer paise (1 INR = 100 paise). */
    amountCents: integer("amount_cents").notNull(),
    currency: text().notNull().default("INR"),
    state: text().notNull().default("initiated"),
    scenario: text().notNull(),
    /** Snapshot of the device network detected by the client at send time. */
    network: jsonb(),
    timeoutMs: integer("timeout_ms").notNull(),
    delayedAt: timestamp("delayed_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_state_idx").on(t.state), index("payments_created_idx").on(t.createdAt)],
);

/** Append-only event ledger rendered as each payment's timeline. */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: serial().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    type: text().notNull(),
    message: text().notNull(),
    meta: jsonb(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_events_payment_idx").on(t.paymentId)],
);

/**
 * Simulated PSP authorizations. Instead of in-process timers (which don't
 * survive serverless invocations) the provider decides the outcome up front
 * and records *when* it resolves; the monitor applies it once due.
 */
export const providerAuthorizations = pgTable(
  "provider_authorizations",
  {
    paymentId: uuid("payment_id")
      .primaryKey()
      .references(() => payments.id, { onDelete: "cascade" }),
    /** settle | decline | stall */
    outcome: text().notNull(),
    /** When the provider answers. Null for a stall (never answers). */
    resolveAt: timestamp("resolve_at", { withTimezone: true }),
    /** open | resolved | voided */
    status: text().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("provider_auth_status_idx").on(t.status, t.resolveAt)],
);

/** Simulated PSP money movement for refunds. Primary key dedupes credits. */
export const providerCredits = pgTable("provider_credits", {
  refundKey: text("refund_key").primaryKey(),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per refund ever issued. `refund_key` = payment:<id>:refund. */
export const refundLedger = pgTable("refund_ledger", {
  refundKey: text("refund_key").primaryKey(),
  paymentId: uuid("payment_id")
    .notNull()
    .unique()
    .references(() => payments.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  reason: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: serial().primaryKey(),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    read: boolean().notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_created_idx").on(t.createdAt)],
);
