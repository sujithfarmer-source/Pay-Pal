"use client";

import { Signal, SignalLow, SignalMedium, SignalHigh, WifiOff, AlertTriangle } from "lucide-react";
import type { NetworkQuality, NetworkSnapshot } from "@/lib/simulation";
import { SCENARIO_LABELS } from "@/lib/simulation";
import { describeNetwork, networkMessage, scenarioForNetwork } from "@/lib/network-detect";

const ICONS: Record<NetworkQuality, typeof Signal> = {
  offline: WifiOff,
  weak: SignalLow,
  moderate: SignalMedium,
  strong: SignalHigh,
  unknown: Signal,
};

const DOT: Record<NetworkQuality, string> = {
  offline: "bg-rose-500",
  weak: "bg-orange-500",
  moderate: "bg-amber-400",
  strong: "bg-emerald-500",
  unknown: "bg-ink-faint",
};

export function NetworkChip({ network }: { network: NetworkSnapshot | null }) {
  const q = network?.quality ?? "unknown";
  const Icon = ICONS[q];
  return (
    <span
      title={network ? describeNetwork(network) : "Detecting connection…"}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft"
    >
      <span className={`size-1.5 rounded-full ${DOT[q]} ${network ? "" : "animate-pulse"}`} />
      <Icon className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">
        {network ? networkMessage(q).title : "Detecting network…"}
      </span>
    </span>
  );
}

export function NetworkBanner({ network }: { network: NetworkSnapshot | null }) {
  if (!network || (network.quality !== "offline" && network.quality !== "weak")) return null;
  const msg = networkMessage(network.quality);
  const scenario = SCENARIO_LABELS[scenarioForNetwork(network.quality)];
  return (
    <div
      role="status"
      className="animate-rise flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50/70 px-4 py-3 text-sm text-orange-900"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{msg.title}</p>
        <p className="text-orange-900/80">
          {msg.body} Simulation: <span className="font-medium">{scenario.label}</span> — {scenario.expectation}
        </p>
      </div>
    </div>
  );
}

export function NetworkDetectionCard({ network }: { network: NetworkSnapshot | null }) {
  const q = network?.quality ?? "unknown";
  const Icon = ICONS[q];
  const scenario = SCENARIO_LABELS[scenarioForNetwork(q)];
  return (
    <div className="rounded-2xl border border-line bg-mist p-4">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-faint uppercase">
        <Icon className="size-3.5" aria-hidden /> Device network
      </div>
      <p className="mt-1.5 text-sm font-medium text-ink">
        {network ? describeNetwork(network) : "Detecting your connection…"}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        <span className="font-medium text-violet-deep">{scenario.label}:</span> {scenario.expectation}
      </p>
    </div>
  );
}
