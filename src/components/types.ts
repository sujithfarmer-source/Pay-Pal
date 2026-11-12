import type { NetworkSnapshot } from "@/lib/simulation";

export interface PaymentView {
  id: string;
  payeeName: string;
  payeeHandle: string;
  note: string;
  amountCents: number;
  currency: string;
  state: "initiated" | "pending" | "completed" | "failed" | "refunded";
  delayed: boolean;
  scenario: string;
  network: NetworkSnapshot | null;
  timeoutMs: number;
  deadline: string;
  createdAt: string;
  settledAt: string | null;
  refundedAt: string | null;
  failureReason: string | null;
}

export interface Stats {
  total: number;
  sentCents: number;
  refundedCents: number;
  refundedCount: number;
  inFlight: number;
}

export interface NotificationView {
  id: number;
  paymentId: string | null;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface PaymentDetail {
  payment: PaymentView;
  events: { id: number; type: string; message: string; createdAt: string }[];
  refund: { refundKey: string; amountCents: number; createdAt: string } | null;
  serverTime: string;
}
