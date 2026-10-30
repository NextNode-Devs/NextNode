"use server";

import { redirect } from "next/navigation";

import { apiPost, type ApiError } from "@/shared/api/server-client";

type Checkout = { checkout_url: string; payment_id: string; amount_cents: number; currency: string };

export type CheckoutState = { error: ApiError } | null;

/**
 * Asks the backend (#7) for a Stripe Checkout session and sends the browser
 * there. The amount is decided by the server; nothing is sent but the project.
 */
export async function startDepositCheckout(projectId: string): Promise<CheckoutState> {
  if (!/^\d+$/.test(projectId)) {
    return { error: { code: "NOT_FOUND", message: "Project not found." } };
  }
  const result = await apiPost<Checkout>(`/api/projects/${projectId}/deposit/checkout/`, undefined, {
    auth: true,
    timeoutMs: 10_000, // the backend calls Stripe before answering
  });
  if (!result.ok) return { error: result.error };
  if (!result.data.checkout_url.startsWith("https://checkout.stripe.com/")) {
    return { error: { code: "BAD_RESPONSE", message: "The checkout link from the server was not a Stripe link." } };
  }
  redirect(result.data.checkout_url); // outside any try: it throws to navigate
}
