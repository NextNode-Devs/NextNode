import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { isConsoleProblem } from "./console";

/**
 * NN-38 (Phase 2 prototype, Aliya's part): the approved new Lead signs the
 * current offer, and the "You no longer have access to this project" screen.
 * Reached through the app as the client, the Team Lead and an outsider; both
 * screens show sample data and their actions say they are under construction.
 * Needs the Clerk development keys.
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

type Person = { page: Page; userId: string; problems: string[] };

async function callApi(page: Page, method: string, path: string, body?: object) {
  await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { session?: unknown } }).Clerk?.session));
  return page.evaluate(
    async ({ api, method, path, body }) => {
      const clerkWindow = window as unknown as { Clerk: { session: { getToken(): Promise<string> } } };
      const token = await clerkWindow.Clerk.session.getToken();
      const response = await fetch(`${api}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    { api: API, method, path, body },
  );
}

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
  expect((await callApi(page, "POST", "/api/onboarding/", body)).status).toBe(201);
  return { page, userId: user.id, problems };
}

const developer = (name: string) => ({
  role: "developer",
  display_name: name,
  developer: { headline: "Full-stack developer", bio: "", github_username: null, skills: ["React"] },
});

/** The account menu mounts only after hydration (app-header), so once it shows, forms respond to clicks. */
async function hydrated(page: Page) {
  await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible({ timeout: 20_000 });
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("New Lead re-sign and access lost (NN-38)", () => {
  test.skip(!hasClerk, "Needs the Clerk development keys");
  let people: Person[] = [];

  test.afterEach(async () => {
    if (people.length === 0) return;
    for (const person of people) await person.page.context().close();
    const ids = people.map((p) => `"${p.userId}"`).join(", ");
    django(
      [
        "from django.db.models import Q",
        "from nextnode.infrastructure.persistence.models import *",
        `accounts = AccountModel.objects.filter(clerk_user_id__in=[${ids}])`,
        "TeamCandidacyModel.objects.filter(Q(lead__in=accounts) | Q(developer__in=accounts)).delete()",
        "LeadCandidacyModel.objects.filter(Q(client__in=accounts) | Q(developer__in=accounts)).delete()",
        "ConversationModel.objects.filter(participants__account__in=accounts).delete()",
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

  test("client follows along, the Lead signs, an outsider is refused", async ({ browser }) => {
    test.setTimeout(240_000);
    const grace = await signedInPerson(browser, "Grace", {
      role: "client",
      display_name: "Grace E2E",
      client: { company_name: "Acme", industry: "Retail" },
    });
    const ada = await signedInPerson(browser, "Ada", developer("Ada E2E"));
    const mary = await signedInPerson(browser, "Mary", developer("Mary E2E"));
    people = [grace, ada, mary];

    // A posted brief with a hired Lead: those journeys are #3's and #4's.
    const created = await callApi(grace.page, "POST", "/api/projects/", {
      title: "Re-sign project",
      description: "A booking app for a small yoga studio, with payments later.",
      tech_stack: ["React"],
      target_delivery_date: `${new Date().getFullYear() + 1}-06-01`,
      proposed_budget_cents: 300_000,
    });
    expect(created.status).toBe(201);
    const projectPath = `/projects/${created.body.data.id}`;
    const applied = await callApi(ada.page, "POST", `${projectPath.replace("/projects", "/api/projects")}/lead-applications/`, { note: "" });
    expect((await callApi(grace.page, "POST", `/api/lead-candidacies/${applied.body.data.id}/hire/`)).status).toBe(200);

    // --- The client: from the Team tab to the signing screen, read-only ---
    await grace.page.goto(`${projectPath}/team`);
    await grace.page.getByRole("link", { name: "The new Lead signs the offer" }).click();
    await expect(grace.page.getByRole("heading", { level: 1, name: "The new Lead signs the offer" })).toBeVisible({ timeout: 20_000 });
    // Next keeps the Team tab mounted (hidden) after navigating, so match this screen's own notice.
    await expect(grace.page.getByRole("note").filter({ hasText: "sample Lead change" })).toBeVisible();
    await expect(grace.page.getByRole("heading", { name: /^Waiting for Marco Ruiz \(sample\) to sign/ })).toBeVisible();
    await expect(grace.page.getByRole("button", { name: /Sign version/ })).toHaveCount(0);

    // --- The Team Lead, on a phone: confirms, then signs (under construction) ---
    await ada.page.setViewportSize({ width: 375, height: 800 });
    await ada.page.goto(`${projectPath}/team/sign-offer`);
    await expect(ada.page.getByRole("heading", { level: 1, name: "Sign the current offer" })).toBeVisible({ timeout: 20_000 });
    await hydrated(ada.page);
    await ada.page.getByRole("button", { name: "Sign version 3" }).click();
    await expect(ada.page.getByRole("alert").filter({ hasText: "Confirm you've read version 3" })).toBeVisible();
    await ada.page.getByRole("checkbox", { name: /I've read offer version 3/ }).click();
    await ada.page.getByRole("button", { name: "Sign version 3" }).click();
    await expect(ada.page.getByRole("status").filter({ hasText: "Signing offer version 3" })).toBeVisible();
    await noSidewaysScroll(ada.page);

    // ...and sees what the former Lead sees.
    await ada.page.getByRole("link", { name: "See what the former Lead sees" }).click();
    await expect(
      ada.page.getByRole("heading", { level: 1, name: "You no longer have access to this project" }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(ada.page.getByRole("button", { name: "You were replaced as Lead" })).toHaveAttribute("aria-pressed", "true");
    await expect(ada.page.getByRole("link", { name: "Go to your dashboard" })).toBeVisible();
    await noSidewaysScroll(ada.page);

    // --- A developer outside the project: refused ---
    await mary.page.goto(`${projectPath}/team/sign-offer`);
    await expect(mary.page.getByRole("heading", { name: "Only the client and team can see this" })).toBeVisible({ timeout: 20_000 });
    await expect(mary.page.getByText("Marco Ruiz (sample)")).toHaveCount(0);

    for (const person of people) expect(person.problems).toEqual([]);
  });
});
