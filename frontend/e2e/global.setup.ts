import { clerkSetup } from "@clerk/testing/playwright";

/** Fetches a Clerk testing token when the development keys are present, so
 * signed-in journeys bypass bot protection. Without keys those specs skip. */
export default async function globalSetup() {
  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    await clerkSetup();
  }
}
