/**
 * The deposit as the server reports it. Mirrors the backend's
 * `DepositStatus` (#7), which #6's start-gate endpoint includes as `deposit`.
 * Only a verified Stripe webhook moves it to `completed`.
 */
export type DepositState = "none" | "pending" | "completed" | "failed";

export type Deposit = {
  status: DepositState;
  amount_cents: number | null;
  currency: string | null;
  completed_at: string | null;
};
