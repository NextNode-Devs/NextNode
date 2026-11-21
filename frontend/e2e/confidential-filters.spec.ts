import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { isConsoleProblem } from "./console";

/**
 * #93 Confidential briefs and developer filters (Phase 2 prototype), through
 * the UI at every width. The Confidential switch and the "To be defined"
 * legal terms sit on the client's brief form and project page, and the switch
 * isn't saved. The directory's time zone and new talent filters live in the
 * URL and narrow the loaded page with sample values. Needs the Clerk
 * development keys. `E2E_SHOTS=1` also saves screenshots to test-results/.
 */
const hasClerk = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const API = "http://127.0.0.1:8100";
const clerkApi = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const nextYear = `${new Date().getFullYear() + 1}-06-01`;

function django(code: string): string {
  return execFileSync("uv", ["run", "python", "manage.py", "shell", "-c", code], {
    cwd: "../backend",
    encoding: "utf8",
    env: { ...process.env, DJANGO_SETTINGS_MODULE: "config.settings" },
  }).trim();
}

type Person = { page: Page; userId: string; problems: string[] };

async function signedInPerson(browser: Browser, name: string, body: object): Promise<Person> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}+clerk_test@example.com`;
  const user = await clerkApi().users.createUser({ emailAddress: [email], firstName: name, skipPasswordRequirement: true });
  const page = await (await browser.newContext()).newPage();
  const problems: string[] = [];
  page.on("console", (m) => {
    if (isConsoleProblem(m)) problems.push(m.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { session?: unknown } }).Clerk?.session));
  const status = await page.evaluate(
    async ({ api, body }) => {
      const clerkWindow = window as unknown as { Clerk: { session: { getToken(): Promise<string> } } };
      const token = await clerkWindow.Clerk.session.getToken();
      const response = await fetch(`${api}/api/onboarding/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return response.status;
    },
    { api: API, body },
  );
  expect(status).toBe(201);
  return { page, userId: user.id, problems };
}

/** The account menu mounts only after hydration (app-header), so once it shows, forms respond to clicks. */
async function hydrated(page: Page) {
  await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible({ timeout: 20_000 });
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function shot(page: Page, name: string) {
  if (!process.env.E2E_SHOTS) return;
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
}

test.describe("Confidential briefs and developer filters", () => {
  test.skip(!hasClerk, "Needs the Clerk development keys");
  let people: Person[] = [];

  test.afterEach(async () => {
    if (people.length === 0) return;
    for (const person of people) await person.page.context().close();
    const ids = people.map((p) => `"${p.userId}"`).join(", ");
    django(
      [
        "from nextnode.infrastructure.persistence.models import *",
        `accounts = AccountModel.objects.filter(clerk_user_id__in=[${ids}])`,
        "projects = ProjectModel.objects.filter(owner__in=accounts)",
        "TeamMembershipModel.objects.filter(team__project__in=projects).delete()",
        "TeamModel.objects.filter(project__in=projects).delete()",
        "projects.delete()",
        "accounts.delete()",
      ].join("\n"),
    );
    for (const person of people) await clerkApi().users.deleteUser(person.userId);
    people = [];
  });

  test("a client sees the Confidential switch and legal terms, and the brief still publishes", async ({ browser }) => {
    test.setTimeout(180_000);
    const grace = await signedInPerson(browser, "Grace", {
      role: "client",
      display_name: "Grace E2E",
      client: { company_name: "Acme", industry: "Retail" },
    });
    people = [grace];
    const page = grace.page;

    await page.goto("/projects/new");
    await hydrated(page);
    await page.getByLabel(/^Title/).fill("Confidential studio app");
    await page.getByLabel(/^Scope/).fill("A booking app for a small yoga studio, with payments later.");
    await page.getByRole("combobox", { name: /^Tech stack/ }).fill("React");
    await page.getByRole("combobox", { name: /^Tech stack/ }).press("Enter");
    await page.getByLabel(/^Target delivery date/).fill(nextYear);
    await page.getByLabel(/^Proposed budget/).fill("2,500");

    const section = page.getByRole("region", { name: "Confidentiality" });
    await expect(section.getByText("Prototype", { exact: true })).toBeVisible();
    const confidential = section.getByRole("switch", { name: "Confidential project" });
    await expect(confidential).toHaveAccessibleDescription(/Not saved yet/);
    await expect(section.getByText("To be defined")).toHaveCount(2);
    await confidential.click();
    await expect(confidential).toBeChecked();
    await expect(section.getByText("Kept out of the team's portfolios")).toBeVisible();
    await noSidewaysScroll(page);
    await shot(page, "brief-form");

    // The switch isn't sent: publishing works exactly as before.
    await page.getByRole("button", { name: "Publish brief" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Project published" })).toBeVisible({ timeout: 20_000 });
    const card = page.getByRole("heading", { name: "Ownership and confidentiality" }).locator("xpath=ancestor::*[@data-slot='card']");
    await expect(card.getByText("To be defined")).toHaveCount(2);
    await expect(card.getByText("These terms need legal review.")).toBeVisible();
    await expect(page.getByText("Confidential", { exact: true })).toHaveCount(0); // no badge: projects don't store it yet
    await noSidewaysScroll(page);
    await shot(page, "project-page");
    expect(grace.problems).toEqual([]);
  });

  test("a developer filters the directory by time zone and new talent", async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const ada = await signedInPerson(browser, "Ada", {
      role: "developer",
      display_name: "Ada E2E",
      developer: { headline: "Full-stack developer", bio: "", github_username: null, skills: ["React"] },
    });
    people = [ada];
    const page = ada.page;
    const phone = testInfo.project.name === "mobile";

    await page.goto("/developers");
    await hydrated(page);
    const filters = page.getByRole("search", { name: "Filter developers" });
    const zone = filters.getByRole("combobox", { name: "Time zone" });
    const more = filters.getByRole("button", { name: /More filters/ });

    if (phone) {
      await expect(zone).toBeHidden();
      await expect(filters.getByLabel("Available for work only")).toBeVisible(); // a working Phase 1 filter stays in view
      await more.click();
      await expect(more).toHaveAttribute("aria-expanded", "true");
    } else {
      await expect(more).toBeHidden();
    }
    await expect(zone).toBeVisible();
    await expect(zone.getByRole("option", { name: "Eastern (Toronto) · EST (UTC-05:00)" })).toBeAttached();

    await filters.getByRole("button", { name: "Explain the new talent filter" }).click();
    await expect(page.getByText(/joined NextNode in the past 15 days/)).toBeVisible();
    await shot(page, "directory-info");
    await page.keyboard.press("Escape");

    await zone.selectOption("America/Toronto");
    await expect(page).toHaveURL(/tz=America%2FToronto/, { timeout: 20_000 });
    await filters.getByLabel("New talent only").check();
    await expect(page).toHaveURL(/new_talent=true/, { timeout: 20_000 });
    await expect(page.getByRole("status").filter({ hasText: /time zone and new talent|Showing|developer/ }).first()).toBeVisible();
    await expect(filters.getByText(/only filter the page you're on/)).toBeVisible();

    // Reloading the URL shows the same filters, still open on a phone.
    await page.reload();
    await hydrated(page);
    await expect(zone).toHaveValue("America/Toronto");
    await expect(filters.getByLabel("New talent only")).toBeChecked();
    if (phone) await expect(more).toContainText("2 on");
    await noSidewaysScroll(page);
    await shot(page, "directory-filtered");
    expect(ada.problems).toEqual([]);
  });
});
