/**
 * Pure payment state machine. Zero I/O.
 *
 * initiated ─▶ pending ─▶ completed
 *     │           ├────▶ failed
 *     │           └────▶ refunded   (timeout auto-refund)
 *     ├──────────────────▶ failed
 *     └──────────────────▶ refunded
 */
export const STATES = ["initiated", "pending", "completed", "failed", "refunded"] as const;
export type PaymentState = (typeof STATES)[number];

const TRANSITIONS: Record<PaymentState, readonly PaymentState[]> = {
  initiated: ["pending", "failed", "refunded"],
  pending: ["completed", "failed", "refunded"],
  completed: [],
  failed: [],
  refunded: [],
};

/** States in which money is "in limbo" and the timeout monitor is watching. */
export const IN_FLIGHT_STATES: readonly PaymentState[] = ["initiated", "pending"];

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(state: PaymentState): boolean {
  return TRANSITIONS[state].length === 0;
}

export function isInFlight(state: PaymentState): boolean {
  return IN_FLIGHT_STATES.includes(state);
}

export function deadlineOf(p: { createdAt: Date; timeoutMs: number }): Date {
  return new Date(p.createdAt.getTime() + p.timeoutMs);
}

export function isOverdue(
  p: { state: PaymentState; createdAt: Date; timeoutMs: number },
  now: Date = new Date(),
): boolean {
  return isInFlight(p.state) && now.getTime() >= deadlineOf(p).getTime();
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: PaymentState,
    public readonly to: PaymentState,
  ) {
    super(`Invalid transition ${from} → ${to}`);
  }
}

export function assertTransition(from: PaymentState, to: PaymentState): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
