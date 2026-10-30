import { clerk } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/nextjs/server";
import { expect, test, type Page } from "@playwright/test";

/**
 * #1 journeys. The signed-out redirect runs everywhere. Onboarding needs the
 * Clerk development keys (frontend/.env.local, or GitHub environment secrets
 * in CI) and skips without them. Never use production keys.
 */
const hasClerk = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  return problems;
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("a signed-out visitor opening /dashboard is sent to sign in, keeping the way back", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
  expect(new URL(page.url()).searchParams.get("redirect_url")).toContain("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
});

test.describe("onboarding", () => {
  test.skip(!hasClerk, "Needs the Clerk development keys");

  const clerkApi = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  let userId: string | undefined;

  test.afterEach(async () => {
    if (userId) await clerkApi().users.deleteUser(userId);
    userId = undefined;
  });

  async function signInAsNewUser(page: Page, name: string) {
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}+clerk_test@example.com`;
    const user = await clerkApi().users.createUser({
      emailAddress: [email],
      firstName: name,
      skipPasswordRequirement: true,
    });
    userId = user.id;
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: email });
  }

  test("a new developer chooses their role once and lands on the dashboard", async ({ page }) => {
    const problems = watchConsole(page);
    await signInAsNewUser(page, "Ada");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding/);

    await page.getByRole("radio", { name: /I'm a developer/ }).check();
    await page.getByLabel(/Headline/).fill("Full-stack developer");
    await page.getByLabel(/GitHub username/).fill("ada-e2e");
    await page.getByLabel(/^Skills/).fill("React");
    await page.keyboard.press("Enter");
    await page.getByLabel(/^Skills/).fill("Django");
    await page.keyboard.press("Enter");
    await noHorizontalScroll(page);
    await page.getByRole("button", { name: "Create my account" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome, Ada");
    await expect(page.getByRole("region", { name: "Invitations" })).toContainText("will appear here");
    await expect(page.getByRole("status").filter({ hasText: /Live|Connecting|Reconnecting/ })).toBeVisible();

    // Reloading, or opening onboarding again, never shows the form again.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard/);
    await noHorizontalScroll(page);
    expect(problems).toEqual([]);
  });

  test("a new client gets client sections, without invitations", async ({ page }) => {
    await signInAsNewUser(page, "Grace");
    await page.goto("/onboarding");
    await page.getByRole("radio", { name: /I'm a client/ }).check();

    // Validation is shown on the field before anything is saved.
    await page.getByRole("button", { name: "Create my account" }).click();
    await expect(page.getByLabel(/Company name/)).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel(/Company name/).fill("Acme Ltd");
    await page.getByLabel(/Industry/).fill("Retail");
    await page.getByRole("button", { name: "Create my account" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("region", { name: "My projects" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Invitations" })).toHaveCount(0);
  });
});
