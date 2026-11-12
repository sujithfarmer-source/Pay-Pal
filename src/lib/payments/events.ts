import { getDb, schema } from "../../../db";

export async function recordEvent(
  paymentId: string,
  type: string,
  message: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await getDb().insert(schema.paymentEvents).values({ paymentId, type, message, meta: meta ?? null });
}

export async function notify(
  paymentId: string,
  kind: string,
  title: string,
  body: string,
): Promise<void> {
  await getDb().insert(schema.notifications).values({ paymentId, kind, title, body });
}
