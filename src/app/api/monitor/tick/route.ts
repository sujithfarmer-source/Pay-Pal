import { sweep } from "@/lib/payments/monitor";

export const dynamic = "force-dynamic";

/** Manually run one timeout-monitor sweep. */
export async function POST() {
  const result = await sweep();
  return Response.json(result);
}
