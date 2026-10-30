import type { ApiError } from "@/shared/api/server-client";

/**
 * What to tell the person when checkout is refused. Business refusals
 * (minimum budget, wrong state, already paid) are the server's own sentence;
 * access and transport failures get a sentence that says what to do.
 */
export function checkoutErrorMessage(error: ApiError): { message: string; retry: boolean } {
  switch (error.code) {
    case "UNAUTHENTICATED":
      return { message: "Sign in as this project's client to pay the deposit.", retry: false };
    case "FORBIDDEN":
    case "NOT_FOUND":
      return { message: "Only this project's client can pay its deposit.", retry: false };
    case "UNREACHABLE":
    case "BAD_RESPONSE":
    case "PAYMENTS_UNAVAILABLE":
    case "INTERNAL_ERROR":
      return { message: error.message, retry: true };
    default:
      return { message: error.message, retry: false };
  }
}
