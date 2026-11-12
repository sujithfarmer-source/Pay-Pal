import { sweepQuietly } from "@/lib/payments/monitor";
import { ValidationError, createPayment, getStats, listPayments, toView } from "@/lib/payments/service";

export const dynamic = "force-dynamic";

export async function GET() {
  await sweepQuietly();
  const [payments, stats] = await Promise.all([listPayments(), getStats()]);
  return Response.json({ payments, stats, serverTime: new Date().toISOString() });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const { payment, created } = await createPayment({
      ...body,
      idempotencyKey: req.headers.get("idempotency-key") ?? (body.idempotencyKey as string | undefined),
    });
    return Response.json({ payment: toView(payment), created }, { status: created ? 201 : 200 });
  } catch (err) {
    if (err instanceof ValidationError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Could not create payment" }, { status: 500 });
  }
}
