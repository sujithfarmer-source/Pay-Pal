"use client";

import { useEffect, useState } from "react";
import type { NetworkSnapshot } from "@/lib/simulation";
import { currentNetwork, subscribeNetwork } from "@/lib/network-detect";

export function useNetwork(): NetworkSnapshot | null {
  const [n, setN] = useState<NetworkSnapshot | null>(() => currentNetwork());
  useEffect(() => subscribeNetwork(setN), []);
  return n;
}

/** Re-render every `ms` so countdowns tick. */
export function useNow(ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
