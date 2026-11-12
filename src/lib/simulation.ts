/** Simulation scenarios shared by server + client. */
export const SCENARIOS = ["instant", "realistic", "slow", "stalled"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABELS: Record<Scenario, { label: string; expectation: string }> = {
  instant: { label: "Near-instant", expectation: "Settles in under a second." },
  realistic: { label: "Realistic mix", expectation: "Settles in 1–4s, with an occasional decline." },
  slow: {
    label: "Slow network",
    expectation: "Settles after the time limit — the auto-refund gets there first.",
  },
  stalled: {
    label: "Stalled",
    expectation: "Never settles — automatically refunded when the time limit is reached.",
  },
};

export function isScenario(v: unknown): v is Scenario {
  return typeof v === "string" && (SCENARIOS as readonly string[]).includes(v);
}

/** Default pending window before a payment is marked delayed and auto-refunded. */
export const DEFAULT_TIMEOUT_MS = 10_000;

export type NetworkQuality = "offline" | "weak" | "moderate" | "strong" | "unknown";

/** What the browser detected about its own connection, sent with each payment. */
export interface NetworkSnapshot {
  quality: NetworkQuality;
  online: boolean;
  effectiveType?: string | null;
  downlinkMbps?: number | null;
  rttMs?: number | null;
  pingMs?: number | null;
  source: "network-information" | "ping" | "offline" | "none";
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(paise / 100);
}
