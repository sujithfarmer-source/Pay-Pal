/**
 * Device-network detection. The pure mapping functions are shared with the
 * server; the browser-only probe lives in `detectNetwork` / `subscribeNetwork`.
 */
import type { NetworkQuality, NetworkSnapshot, Scenario } from "./simulation";

export function scenarioForNetwork(q: NetworkQuality): Scenario {
  switch (q) {
    case "offline":
      return "stalled";
    case "weak":
      return "slow";
    case "strong":
      return "instant";
    default:
      return "realistic";
  }
}

export function qualityFromEffectiveType(t: string | null | undefined): NetworkQuality | null {
  if (!t) return null;
  if (t === "slow-2g" || t === "2g") return "weak";
  if (t === "3g") return "moderate";
  if (t === "4g") return "strong";
  return null;
}

export function qualityFromPing(ms: number | null | undefined): NetworkQuality {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "unknown";
  if (ms > 900) return "weak";
  if (ms >= 250) return "moderate";
  return "strong";
}

const QUALITY_TEXT: Record<NetworkQuality, string> = {
  offline: "offline",
  weak: "weak connection",
  moderate: "moderate connection",
  strong: "strong connection",
  unknown: "connection not measurable",
};

export function describeNetwork(n: NetworkSnapshot): string {
  const parts = [QUALITY_TEXT[n.quality]];
  if (n.effectiveType) parts.push(n.effectiveType.toUpperCase());
  if (n.pingMs != null) parts.push(`${Math.round(n.pingMs)} ms ping`);
  else if (n.rttMs != null) parts.push(`${Math.round(n.rttMs)} ms RTT`);
  if (n.downlinkMbps != null) parts.push(`${n.downlinkMbps} Mbps`);
  return parts.join(" · ");
}

export function networkMessage(q: NetworkQuality): { title: string; body: string } {
  switch (q) {
    case "offline":
      return {
        title: "You're offline",
        body: "Payments sent now won't reach the provider. Anything stuck is refunded automatically when the time limit is reached.",
      };
    case "weak":
      return {
        title: "Weak connection detected",
        body: "Payments may settle late. If one is still pending at the time limit, GoPay refunds it automatically.",
      };
    case "moderate":
      return { title: "Moderate connection", body: "Payments should settle within a few seconds." };
    case "strong":
      return { title: "Strong connection", body: "Payments should settle almost instantly." };
    default:
      return { title: "Connection unknown", body: "Using a realistic mix of outcomes." };
  }
}

// ---------------------------------------------------------------------------
// Browser-only probe
// ---------------------------------------------------------------------------

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

function connection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

async function ping(timeoutMs = 4000): Promise<number | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(`/api/health?t=${Date.now()}`, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return performance.now() - start;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function detectNetwork(): Promise<NetworkSnapshot> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { quality: "offline", online: false, source: "offline" };
  }
  const c = connection();
  const pingMs = await ping();
  const base = {
    online: true,
    effectiveType: c?.effectiveType ?? null,
    downlinkMbps: c?.downlink ?? null,
    rttMs: c?.rtt ?? null,
    pingMs: pingMs === null ? null : Math.round(pingMs),
  };
  const fromApi = qualityFromEffectiveType(c?.effectiveType);
  if (fromApi) return { ...base, quality: fromApi, source: "network-information" };
  if (pingMs === null) return { ...base, quality: "offline", online: false, source: "ping" };
  return { ...base, quality: qualityFromPing(pingMs), source: "ping" };
}

type Listener = (n: NetworkSnapshot) => void;
const listeners = new Set<Listener>();
let current: NetworkSnapshot | null = null;
let started = false;

async function refresh() {
  current = await detectNetwork();
  listeners.forEach((l) => l(current!));
}

/** Singleton subscription: one probe loop shared by every component. */
export function subscribeNetwork(listener: Listener): () => void {
  listeners.add(listener);
  if (current) listener(current);
  if (!started && typeof window !== "undefined") {
    started = true;
    void refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    connection()?.addEventListener("change", refresh);
    setInterval(refresh, 15_000);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function currentNetwork(): NetworkSnapshot | null {
  return current;
}
