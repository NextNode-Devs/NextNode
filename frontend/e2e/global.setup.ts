import { clerkSetup } from "@clerk/testing/playwright";

import { removeStaleE2eUsers } from "./clerk-cleanup";

/** Fetches a Clerk testing token when the development keys are present, so
 * signed-in journeys bypass bot protection. Without keys those specs skip.
 * First it removes test users left behind by cancelled runs, so the
 * development instance's user limit is never reached. */
export default async function globalSetup() {
  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    await removeStaleE2eUsers(process.env.CLERK_SECRET_KEY);
    await clerkSetup();
  }
}
