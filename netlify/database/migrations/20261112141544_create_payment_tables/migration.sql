CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY,
	"payment_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" serial PRIMARY KEY,
	"payment_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"idempotency_key" text NOT NULL UNIQUE,
	"payee_name" text NOT NULL,
	"payee_handle" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"state" text DEFAULT 'initiated' NOT NULL,
	"scenario" text NOT NULL,
	"network" jsonb,
	"timeout_ms" integer NOT NULL,
	"delayed_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_authorizations" (
	"payment_id" uuid PRIMARY KEY,
	"outcome" text NOT NULL,
	"resolve_at" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_credits" (
	"refund_key" text PRIMARY KEY,
	"payment_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund_ledger" (
	"refund_key" text PRIMARY KEY,
	"payment_id" uuid NOT NULL UNIQUE,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" ("created_at");--> statement-breakpoint
CREATE INDEX "payment_events_payment_idx" ON "payment_events" ("payment_id");--> statement-breakpoint
CREATE INDEX "payments_state_idx" ON "payments" ("state");--> statement-breakpoint
CREATE INDEX "payments_created_idx" ON "payments" ("created_at");--> statement-breakpoint
CREATE INDEX "provider_auth_status_idx" ON "provider_authorizations" ("status","resolve_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "provider_authorizations" ADD CONSTRAINT "provider_authorizations_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "provider_credits" ADD CONSTRAINT "provider_credits_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "refund_ledger" ADD CONSTRAINT "refund_ledger_payment_id_payments_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE;