import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * #4 conversations screen: layout and keyboard. The live chat itself, from a
 * real application to a hire, is in hire-lead.spec.ts. Needs the Clerk
 * development keys (skips without them).
 */
const hasClerk = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const API = "http://127.0.0.1:8100";

const clerkApi = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/** Runs Python against the e2e backend's database (same .env / environment as its server). */
function django(code: string): string {
  return execFileSync("uv", ["run", "python", "manage.py", "shell", "-c", code], {
    cwd: "../backend",
    encoding: "utf8",
    env: { ...process.env, DJANGO_SETTINGS_MODULE: "config.settings" },
  }).trim();
}

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

type Person = { page: Page; userId: string; name: string; problems: string[] };

async function signedInPerson(browser: Browser, name: string, body: object): Promise<Person> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}+clerk_test@example.com`;
  const user = await clerkApi().users.createUser({ emailAddress: [email], firstName: name, skipPasswordRequirement: true });
  const page = await (await browser.newContext()).newPage();
  const problems = watchConsole(page);
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  // Onboarding has its own e2e journey (auth.spec.ts); here it's set up through the API.
  const status = await page.evaluate(
    async ({ api, payload }) => {
      const token = await (window as unknown as { Clerk: { session: { getToken(): Promise<string> } } }).Clerk.session.getToken();
      const response = await fetch(`${api}/api/onboarding/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return response.status;
    },
    { api: API, payload: body },
  );
  expect(status).toBe(201);
  return { page, userId: user.id, name, problems };
}

test.describe("hiring conversations", () => {
  test.skip(!hasClerk, "Needs the Clerk development keys");
  let people: Person[] = [];

  test.afterEach(async () => {
    if (people.length === 0) return;
    // The e2e backend shares the local database: remove the test accounts and their conversations too.
    const ids = people.map((p) => `"${p.userId}"`).join(", ");
    django(
      [
        "from nextnode.infrastructure.persistence.models import AccountModel, ConversationModel",
        `accounts = AccountModel.objects.filter(clerk_user_id__in=[${ids}])`,
        "ConversationModel.objects.filter(participants__account__in=accounts).delete()",
        "accounts.delete()",
      ].join("\n"),
    );
    for (const person of people) await clerkApi().users.deleteUser(person.userId);
    people = [];
  });

  test("the conversations screen fits the viewport and works by keyboard", async ({ browser }) => {
    test.setTimeout(90_000);
    const grace = await signedInPerson(browser, "Grace", {
      role: "client",
      display_name: "Grace",
      client: { company_name: "Acme", industry: "Retail" },
    });
    people = [grace];
    const { page } = grace;

    await page.goto("/conversations");
    await expect(page.getByRole("heading", { level: 1, name: "Conversations" })).toBeVisible();
    await expect(page.getByText(/No conversations yet/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Conversations", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // The header's Conversations link is reachable with Tab alone.
    const link = page.getByRole("link", { name: "Conversations", exact: true });
    const focused = () => link.evaluate((el) => el === document.activeElement);
    for (let presses = 0; presses < 8 && !(await focused()); presses++) await page.keyboard.press("Tab");
    await expect(link).toBeFocused();

    expect(grace.problems).toEqual([]);
  });
});
