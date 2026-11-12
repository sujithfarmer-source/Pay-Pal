import { sweepQuietly } from "@/lib/payments/monitor";
import { getPaymentDetail } from "@/lib/payments/service";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  await sweepQuietly();
  const detail = await getPaymentDetail(id);
  if (!detail) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...detail, serverTime: new Date().toISOString() });
}
