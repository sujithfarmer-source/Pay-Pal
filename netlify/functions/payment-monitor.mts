import type { Config } from "@netlify/functions";
import { sweep } from "../../src/lib/payments/monitor";

/**
 * Backstop for the timeout monitor: sweeps once a minute so overdue payments
 * are refunded even when nobody has the app open.
 */
export default async () => {
  const result = await sweep();
  console.log("[payment-monitor]", JSON.stringify(result));
};

export const config: Config = {
  schedule: "* * * * *",
};
