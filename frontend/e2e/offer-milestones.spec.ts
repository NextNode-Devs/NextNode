import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { isConsoleProblem } from "./console";

/**
 * #94 Offer milestones (Phase 2 prototype), through the UI at every width: the
 * hired Team Lead plans the milestones and deposit, the client picks the
 * deposit-release milestone and accepts, an outsider is refused. Sending and
 * accepting say they are under construction. Needs the Clerk development keys.
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

test.describe("Offer milestones", () => {
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
  test("the Lead plans, the client chooses and accepts, an outsider is refused", async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const grace = await signedInPerson(browser, "Grace", {
      role: "client",
      display_name: "Grace E2E",
      client: { company_name: "Acme", industry: "Retail" },
    });
    const ada = await signedInPerson(browser, "Ada", developer("Ada E2E"));
    const mary = await signedInPerson(browser, "Mary", developer("Mary E2E"));
    people = [grace, ada, mary];

    // A posted brief (CAD 3,000) with a hired Lead: those journeys are #3's and #4's.
    const created = await callApi(grace.page, "POST", "/api/projects/", {
      title: "Offer milestones project",
      description: "A booking app for a small yoga studio, with payments later.",
      tech_stack: ["React"],
      target_delivery_date: `${new Date().getFullYear() + 1}-06-01`,
      proposed_budget_cents: 300_000,
    });
    expect(created.status).toBe(201);
    const projectPath = `/projects/${created.body.data.id}`;
    const applied = await callApi(ada.page, "POST", `/api/projects/${created.body.data.id}/lead-applications/`, { note: "" });
    expect((await callApi(grace.page, "POST", `/api/lead-candidacies/${applied.body.data.id}/hire/`)).status).toBe(200);

    // --- The Team Lead plans the milestones from the project page ---
    await ada.page.goto(projectPath);
    await hydrated(ada.page);
    await ada.page.getByRole("link", { name: "Plan milestones" }).click();
    await expect(ada.page.getByRole("heading", { level: 1, name: "Offer milestones" })).toBeVisible({ timeout: 20_000 });
    await hydrated(ada.page);
    await expect(ada.page.getByText(/sending this as the/)).toContainText("Team Lead of Offer milestones project");
    const total = ada.page.getByRole("status").filter({ hasText: "offer total" });
    await expect(total).toHaveText("Milestones add up to CAD 3,000.00 of the CAD 3,000.00 offer total.");

    // Amounts that don't add up are refused, with the reason.
    const firstAmount = ada.page.getByLabel(/^Amount/).first();
    await firstAmount.fill("500");
    await expect(total).toContainText("CAD 400.00 left");
    await ada.page.getByRole("button", { name: "Send milestones with the offer" }).click();
    await expect(ada.page.getByRole("alert").filter({ hasText: "must add up to the offer total" })).toBeVisible();
    await noSidewaysScroll(ada.page);

    // Fixed, with a higher agreed deposit: sending is under construction.
    await firstAmount.fill("900");
    await ada.page.getByLabel("Deposit").selectOption("30");
    await ada.page.getByRole("button", { name: "Send milestones with the offer" }).click();
    await expect(
      ada.page.getByRole("status").filter({ hasText: "Sending the milestones with your offer: this function is under construction." }),
    ).toBeVisible();

    // --- The client reviews, picks milestone 1 or 2 and accepts all together ---
    await grace.page.goto(projectPath);
    await hydrated(grace.page);
    await grace.page.getByRole("link", { name: "View milestones" }).click();
    await expect(grace.page.getByRole("heading", { level: 1, name: "Offer milestones" })).toBeVisible({ timeout: 20_000 });
    await hydrated(grace.page);
    await expect(grace.page.getByRole("list", { name: "Milestones" }).getByRole("listitem")).toHaveCount(3);
    await expect(grace.page.getByRole("radio")).toHaveCount(2);
    await grace.page.getByRole("button", { name: "Accept all 3 milestones" }).click();
    await expect(grace.page.getByText("Choose milestone 1 or 2.")).toBeVisible();

    await grace.page.getByRole("button", { name: "When is the deposit released?" }).click();
    await expect(grace.page.getByText(/refunded minus Stripe's processing fee/)).toBeVisible();
    await grace.page.keyboard.press("Escape");
    await expect(grace.page.locator("body")).not.toContainText(/proof of work/i);

    await grace.page.getByRole("radio", { name: /^Milestone 2:/ }).click();
    await grace.page.getByRole("button", { name: "Accept all 3 milestones" }).click();
    await expect(
      grace.page.getByRole("status").filter({ hasText: "Accepting the offer's milestones: this function is under construction." }),
    ).toBeVisible();
    await noSidewaysScroll(grace.page);

    // --- Someone outside the project can't see the offer ---
    await mary.page.goto(`${projectPath}/offer-milestones`);
    await expect(mary.page.getByRole("heading", { level: 1, name: "The offer is private" })).toBeVisible({ timeout: 20_000 });

    for (const person of people) expect(person.problems, `console errors (${testInfo.project.name})`).toEqual([]);
  });
});
