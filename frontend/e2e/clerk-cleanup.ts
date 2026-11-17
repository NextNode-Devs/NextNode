import { createClerkClient } from "@clerk/nextjs/server";

/**
 * Every signed-in spec creates Clerk users named
 * `e2e-<timestamp>-<random>+clerk_test@example.com` and deletes them in its
 * `afterAll`. A run that is cancelled (CI cancels a branch's running job on a
 * new push) or crashes never reaches `afterAll`, so its users stay behind.
 * The Clerk development instance holds at most 100 users; once full, every
 * `createUser` fails with "Forbidden" and the whole suite fails (17 Nov 2026).
 *
 * Before the suite starts, this deletes leftover test users older than
 * `maxAgeMs`. The age limit protects a run still going on another branch.
 * Only addresses matching the pattern are touched, and only with a
 * development (`sk_test_`) key.
 */
const E2E_EMAIL = /^e2e-\d+-[a-z0-9]*\+clerk_test@example\.com$/;
const ONE_HOUR = 60 * 60 * 1000;

export function isStaleE2eUser(emails: readonly string[], createdAt: number, now: number, maxAgeMs = ONE_HOUR): boolean {
  return emails.length > 0 && emails.every((email) => E2E_EMAIL.test(email)) && now - createdAt > maxAgeMs;
}

export async function removeStaleE2eUsers(secretKey: string, maxAgeMs = ONE_HOUR): Promise<void> {
  if (!secretKey.startsWith("sk_test_")) return; // never against a production instance
  const clerk = createClerkClient({ secretKey });
  const now = Date.now();
  const stale: string[] = [];
  try {
    for (let offset = 0; ; offset += 100) {
      const page = await clerk.users.getUserList({ limit: 100, offset, query: "clerk_test" });
      for (const user of page.data) {
        const emails = user.emailAddresses.map((entry) => entry.emailAddress);
        if (isStaleE2eUser(emails, user.createdAt, now, maxAgeMs)) stale.push(user.id);
      }
      if (page.data.length < 100) break;
    }
    for (const id of stale) await clerk.users.deleteUser(id);
    if (stale.length > 0) console.log(`[e2e] Removed ${stale.length} leftover Clerk test users.`);
  } catch (error) {
    // Housekeeping only: never fail the suite because of it.
    console.warn(`[e2e] Could not clean up leftover Clerk test users: ${String(error)}`);
  }
}
