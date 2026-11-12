import { sweepQuietly } from "@/lib/payments/monitor";
import { listNotifications, markAllNotificationsRead } from "@/lib/payments/service";

export const dynamic = "force-dynamic";

export async function GET() {
  await sweepQuietly();
  const notifications = await listNotifications();
  return Response.json({ notifications, unread: notifications.filter((n) => !n.read).length });
}

export async function POST() {
  await markAllNotificationsRead();
  return Response.json({ ok: true });
}
