import { createHmac } from "node:crypto";

/**
 * Deposits in e2e (#7). By default the backend's checkout skips Stripe
 * (`STRIPE_FAKE_CHECKOUT`, set by playwright.config.ts) and the spec plays
 * Stripe's part: it sends the webhook, signed the way Stripe signs it, and the
 * backend verifies it as it would a real one. The secret is made up for these
 * runs and opens nothing.
 *
 * `E2E_REAL_STRIPE=1` uses backend/.env's test keys and real Stripe Checkout
 * instead, with `stripe listen --forward-to localhost:8100/api/payments/stripe/webhook/`.
 */
export const E2E_WEBHOOK_SECRET = "whsec_e2e_not_a_stripe_secret";
export const REAL_STRIPE = process.env.E2E_REAL_STRIPE === "1";

const WEBHOOK = "http://127.0.0.1:8100/api/payments/stripe/webhook/";

type CheckoutEvent = {
  eventId: string;
  type: "checkout.session.completed" | "checkout.session.async_payment_failed" | "checkout.session.expired";
  sessionId: string;
  paymentId: string;
  amountCents: number;
};

function payload(event: CheckoutEvent): string {
  return JSON.stringify({
    id: event.eventId,
    object: "event",
    type: event.type,
    data: {
      object: {
        id: event.sessionId,
        object: "checkout.session",
        amount_total: event.amountCents,
        currency: "cad",
        payment_status: event.type === "checkout.session.completed" ? "paid" : "unpaid",
        metadata: { payment_id: event.paymentId },
      },
    },
  });
}

/** `Stripe-Signature`: `t=<seconds>,v1=<HMAC-SHA256 of "t.payload">`. */
export function stripeSignature(body: string, secret = E2E_WEBHOOK_SECRET): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

/** Delivers a checkout event to the backend's webhook, as Stripe would. */
export async function sendWebhook(event: CheckoutEvent, signature?: string): Promise<number> {
  const body = payload(event);
  const response = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": signature ?? stripeSignature(body) },
    body,
  });
  return response.status;
}
