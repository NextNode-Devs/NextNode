import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * #2 portfolios and the developer directory, as two people in two browsers:
 * a developer edits their portfolio, a client finds them with the skill
 * filter and opens it. Needs the Clerk development keys (skips without them).
 */
const hasClerk = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const API = "http://127.0.0.1:8100";
const clerkApi = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

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

type Person = { page: Page; userId: string; problems: string[] };

async function signedInPerson(browser: Browser, name: string, body: object): Promise<Person> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}+clerk_test@example.com`;
  const user = await clerkApi().users.createUser({ emailAddress: [email], firstName: name, skipPasswordRequirement: true });
  const page = await (await browser.newContext()).newPage();
  const problems = watchConsole(page);
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  // Onboarding has its own journey (auth.spec.ts); here it's set up through the API.
  const status = await call(page, "POST", "/api/onboarding/", body);
  expect(status).toBe(201);
  return { page, userId: user.id, problems };
}

/** A request from the signed-in browser, with its own Clerk token. Returns the status. */
function call(page: Page, method: string, path: string, body?: object): Promise<number> {
  return page.evaluate(
    async ({ api, method, path, body }) => {
      const clerkWindow = window as unknown as { Clerk: { session: { getToken(): Promise<string> } } };
      const token = await clerkWindow.Clerk.session.getToken();
      const response = await fetch(`${api}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return response.status;
    },
    { api: API, method, path, body },
  );
}

/** Nothing pokes out sideways: the page never needs a horizontal scroll. */
async function fitsWidth(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("portfolios and the developer directory", () => {
  test.skip(!hasClerk, "Needs the Clerk development keys");
  let people: Person[] = [];
  // A skill no other account in the shared local database has, so the filter finds exactly one developer.
  const skill = `E2E${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  test.afterEach(async () => {
    if (people.length === 0) return;
    const ids = people.map((p) => `"${p.userId}"`).join(", ");
    django(
      [
        "from nextnode.infrastructure.persistence.models import AccountModel, SkillModel",
        `AccountModel.objects.filter(clerk_user_id__in=[${ids}]).delete()`,
        `SkillModel.objects.filter(key="${skill.toLowerCase()}").delete()`,
      ].join("\n"),
    );
    for (const person of people) await clerkApi().users.deleteUser(person.userId);
    people = [];
  });

  test("a developer edits their portfolio, a client finds it by skill and opens it", async ({ browser }, testInfo) => {
    test.setTimeout(150_000);
    const ada = await signedInPerson(browser, "Ada", {
      role: "developer",
      display_name: "Ada E2E",
      developer: { headline: "Backend developer", bio: "", github_username: null, skills: ["Python"] },
    });
    const grace = await signedInPerson(browser, "Grace", {
      role: "client",
      display_name: "Grace E2E",
      client: { company_name: "Acme", industry: "Retail" },
    });
    people = [ada, grace];

    // --- The developer edits their portfolio, starting from the dashboard ---
    await ada.page.goto("/dashboard");
    await ada.page.getByRole("region", { name: "Your portfolio" }).getByRole("link", { name: "Edit portfolio" }).click();
    await expect(ada.page.getByRole("heading", { level: 1, name: "Edit your portfolio" })).toBeVisible();

    const headline = ada.page.getByLabel("Headline");
    await headline.fill("Full-stack developer");
    await ada.page.getByLabel(/^Skills/).fill(skill);
    await ada.page.getByLabel(/^Skills/).press("Enter");
    await ada.page.getByRole("button", { name: "Add a project" }).click();
    await ada.page.getByLabel("Title").fill("Analytical Engine");
    await ada.page.getByLabel("Repository link").fill("github.com/ada/engine"); // no https://
    await ada.page.getByLabel(/Live demo link/).fill("https://engine.example.com");
    await ada.page.getByLabel("Available for work").check();
    await ada.page.getByRole("button", { name: "Save portfolio" }).click();

    // A mistake is refused with the message on the field, and nothing is saved.
    const repository = ada.page.getByLabel("Repository link");
    await expect(repository).toHaveAttribute("aria-invalid", "true");
    await expect(ada.page.getByText("Enter a full link starting with https://").filter({ visible: true })).toBeVisible();
    // Next.js adds its own hidden role="alert" route announcer to every page; pick the form's alert.
    await expect(ada.page.getByRole("alert").filter({ hasText: "Your portfolio wasn't saved" })).toBeVisible();

    await repository.fill("https://github.com/ada/engine");
    await ada.page.getByRole("button", { name: "Save portfolio" }).click();
    await expect(ada.page.getByRole("status").filter({ hasText: "Portfolio saved" })).toBeVisible();
    await expect(ada.page.getByRole("heading", { level: 1, name: "Ada E2E" })).toBeVisible();
    // Next.js 16 keeps the previous page hidden after navigating, so text checks look at visible text only.
    await expect(ada.page.getByText("Full-stack developer", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(ada.page.getByText("Available for work", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(ada.page.getByRole("link", { name: /Repository/ })).toHaveAttribute(
      "href",
      "https://github.com/ada/engine",
    );
    const adaUrl = ada.page.url().replace(/\?.*$/, "");

    // Saved for real: a reload shows the same portfolio.
    await ada.page.goto(adaUrl);
    await expect(ada.page.getByText("Analytical Engine", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(ada.page.getByRole("link", { name: "Edit portfolio" })).toBeVisible();

    // --- The client finds the developer with the skill filter ---
    await grace.page.goto("/dashboard");
    await grace.page.getByRole("region", { name: "Find developers" }).getByRole("link", { name: "Browse developers" }).click();
    await expect(grace.page.getByRole("heading", { level: 1, name: "Developers" })).toBeVisible();
    await grace.page.getByLabel(/^Skills/).fill(skill);
    await grace.page.getByLabel(/^Skills/).press("Enter");
    await expect(grace.page).toHaveURL(new RegExp(`skills=${skill}`));
    const results = grace.page.getByRole("list").filter({ has: grace.page.getByRole("link", { name: "Ada E2E" }) });
    // Only the result cards: each card nests its own list of skill tags.
    await expect(results.locator(":scope > li")).toHaveCount(1);
    await expect(grace.page.getByRole("link", { name: "Grace E2E" })).toHaveCount(0); // clients never appear

    // The URL reproduces the view, and the availability filter keeps her.
    await grace.page.reload();
    await expect(grace.page.getByRole("link", { name: "Ada E2E" })).toBeVisible();
    await grace.page.getByLabel("Available for work only").check();
    await expect(grace.page).toHaveURL(/available=true/);
    await expect(grace.page.getByRole("link", { name: "Ada E2E" })).toBeVisible();

    // --- ...and opens the portfolio: no edit controls for someone else's ---
    await grace.page.getByRole("link", { name: "Ada E2E" }).click();
    await expect(grace.page).toHaveURL(adaUrl);
    await expect(grace.page.getByRole("heading", { level: 1, name: "Ada E2E" })).toBeVisible();
    await expect(grace.page.getByText("Analytical Engine", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(grace.page.getByRole("link", { name: "Edit portfolio" })).toHaveCount(0);
    await expect(grace.page.locator("body")).not.toContainText(/verified/i);

    // Editing someone else's portfolio through the API is refused.
    const adaId = adaUrl.split("/").pop();
    // Sent from the test runner, not the page: the browser logs every refused request as a console error.
    const graceToken = await grace.page.evaluate(() =>
      (window as unknown as { Clerk: { session: { getToken(): Promise<string> } } }).Clerk.session.getToken(),
    );
    const refused = await grace.page.request.put(`${API}/api/developers/${adaId}/`, {
      headers: { Authorization: `Bearer ${graceToken}` },
      data: { headline: "x", skills: ["x"], projects: [], is_available: false },
    });
    expect(refused.status()).toBe(403);

    // Turning availability off takes her out of the "available" filter.
    await ada.page.getByRole("link", { name: "Edit portfolio" }).click();
    await ada.page.getByLabel("Available for work").uncheck();
    await ada.page.getByRole("button", { name: "Save portfolio" }).click();
    await expect(ada.page.getByRole("status").filter({ hasText: "Portfolio saved" })).toBeVisible();
    await grace.page.goto(`/developers?skills=${skill}&available=true`);
    await expect(grace.page.getByRole("heading", { name: "No developers match these filters" })).toBeVisible();
    await grace.page.getByRole("link", { name: "Clear filters" }).click();
    await expect(grace.page).toHaveURL(/\/developers$/);

    // Every width the project covers: no sideways scroll on either screen.
    for (const page of [grace.page, ada.page]) {
      await page.goto(adaUrl);
      await fitsWidth(page);
      await page.goto(`/developers?skills=${skill}`);
      await fitsWidth(page);
    }
    expect(ada.problems, `console errors (${testInfo.project.name})`).toEqual([]);
    expect(grace.problems, `console errors (${testInfo.project.name})`).toEqual([]);
  });
});
