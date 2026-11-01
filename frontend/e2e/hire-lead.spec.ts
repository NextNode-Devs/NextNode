import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * #4 Hire Lead, the whole way through the UI with three people in three
 * browsers: two developers apply to lead a client's project, the client picks
 * one from the dashboard, they talk live (including a dropped connection),
 * the client hires, and the other applicant's conversation closes live.
 * Needs the Clerk development keys (skips without them) and Redis.
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

type Person = { page: Page; userId: string; name: string; problems: string[] };

/** A call to the API as the page's signed-in user (setup only; people act through the UI). */
async function callApi(page: Page, method: string, path: string, body?: object) {
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
    if (m.type() === "error" || /hydrat/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  // Onboarding has its own journey (auth.spec.ts); here it's set up through the API.
  expect((await callApi(page, "POST", "/api/onboarding/", body)).status).toBe(201);
  return { page, userId: user.id, name, problems };
}

const developer = (name: string) => ({
  role: "developer",
  display_name: name,
  developer: { headline: "Full-stack developer", bio: "", github_username: null, skills: ["React"] },
});

test.describe("Hire Lead", () => {
  test.skip(!hasClerk, "Needs the Clerk development keys");
  let people: Person[] = [];

  test.afterEach(async () => {
    if (people.length === 0) return;
    // The e2e backend shares the local database: remove everything these accounts made.
    const ids = people.map((p) => `"${p.userId}"`).join(", ");
    django(
      [
        "from django.db.models import Q",
        "from nextnode.infrastructure.persistence.models import *",
        `accounts = AccountModel.objects.filter(clerk_user_id__in=[${ids}])`,
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

  test("apply, pick from the dashboard, talk live through a dropped connection, hire, the other closes live", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One three-browser run is enough");
    test.setTimeout(240_000);

    const grace = await signedInPerson(browser, "Grace", {
      role: "client",
      display_name: "Grace E2E",
      client: { company_name: "Acme", industry: "Retail" },
    });
    const ada = await signedInPerson(browser, "Ada", developer("Ada E2E"));
    const linus = await signedInPerson(browser, "Linus", developer("Linus E2E"));
    people = [grace, ada, linus];

    // The brief has its own UI journey (projects.spec.ts).
    const created = await callApi(grace.page, "POST", "/api/projects/", {
      title: "Yoga studio bookings",
      description: "A booking app for a small yoga studio, with payments later.",
      tech_stack: ["React"],
      target_delivery_date: `${new Date().getFullYear() + 1}-06-01`,
      proposed_budget_cents: 300_000,
    });
    expect(created.status).toBe(201);
    const projectPath = `/projects/${created.body.data.id}`;

    // --- Two developers apply on the project's page ---
    for (const [person, note] of [
      [ada, "I've led two React teams."],
      [linus, "Happy to lead this."],
    ] as const) {
      await person.page.goto(projectPath);
      await person.page.getByRole("button", { name: "Apply to lead" }).click();
      await person.page.getByLabel(/Note to the client/).fill(note);
      await person.page.getByRole("button", { name: "Send application" }).click();
      await expect(person.page.getByRole("status").filter({ hasText: "talking with the client" })).toBeVisible();
      // The conversation appears on the same page, live.
      await expect(person.page.getByRole("heading", { name: "Your conversation with the client" })).toBeVisible({
        timeout: 20_000,
      });
    }

    // --- The client sees both on the dashboard and opens Ada's ---
    await grace.page.goto("/dashboard");
    const applications = grace.page.getByRole("region", { name: "Applications" });
    await expect(applications.getByRole("link", { name: /Linus E2E/ })).toBeVisible();
    await applications.getByRole("link", { name: /Ada E2E/ }).click();
    await expect(grace.page.getByRole("heading", { name: "Team Lead conversations" })).toBeVisible();
    await expect(grace.page.getByRole("button", { name: /Ada E2E/ })).toHaveAttribute("aria-pressed", "true");
    await expect(grace.page.getByText("I've led two React teams.")).toBeVisible();

    // --- They talk live ---
    const graceBox = grace.page.getByRole("textbox", { name: "Message" });
    const adaLog = ada.page.getByRole("log", { name: "Messages" });
    await expect(grace.page.getByText("Enter to send")).toBeVisible({ timeout: 20_000 }); // connected
    await graceBox.fill("Hi Ada, when could you start?");
    await graceBox.press("Enter");
    await expect(adaLog).toContainText("Hi Ada, when could you start?");

    // Ada's connection drops; what Grace sends meanwhile arrives once, in order, when it's back.
    const before = ada.problems.length;
    await ada.page.context().setOffline(true);
    for (const text of ["First while you were away.", "Second while you were away."]) {
      await graceBox.fill(text);
      await graceBox.press("Enter");
      await expect(grace.page.getByRole("log", { name: "Messages" })).toContainText(text);
    }
    await ada.page.context().setOffline(false);
    await expect(adaLog).toContainText("Second while you were away.", { timeout: 30_000 });
    const texts = await adaLog.getByRole("listitem").allInnerTexts();
    const first = texts.findIndex((t) => t.includes("First while you were away."));
    const second = texts.findIndex((t) => t.includes("Second while you were away."));
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(texts.filter((t) => t.includes("First while you were away."))).toHaveLength(1);
    // Failed requests while offline are expected; anything else still counts.
    const offline = /ERR_INTERNET_DISCONNECTED|WebSocket|Failed to fetch|NetworkError/i;
    ada.problems.splice(before, Infinity, ...ada.problems.slice(before).filter((p) => !offline.test(p)));

    // A reload keeps the history, in order, once each.
    await ada.page.reload();
    await expect(adaLog.getByRole("listitem")).toHaveCount(3, { timeout: 20_000 });
    await expect(adaLog.getByRole("listitem").first()).toContainText("when could you start?");

    // --- The client hires Ada; both see it live, and Linus's conversation closes live ---
    await grace.page.getByRole("button", { name: "Hire as Team Lead" }).click();
    await grace.page.getByRole("button", { name: "Hire Ada E2E" }).click();
    await expect(grace.page.getByRole("status").filter({ hasText: "You hired Ada E2E as Team Lead" })).toBeVisible();
    await expect(ada.page.getByRole("status").filter({ hasText: "You were hired as Team Lead" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(linus.page.getByText("This conversation is closed")).toBeVisible({ timeout: 20_000 });
    await expect(linus.page.getByText("Another candidate was hired.").first()).toBeVisible();
    await expect(linus.page.getByRole("textbox", { name: "Message" })).toHaveCount(0);

    // --- It persists: Ada leads the project; the client's list shows the outcome ---
    await ada.page.goto("/dashboard");
    await expect(ada.page.getByRole("region", { name: "My projects" }).getByText("Team Lead", { exact: true })).toBeVisible();
    await grace.page.goto(projectPath);
    await expect(grace.page.getByRole("button", { name: /Ada E2E.*Hired/ })).toBeVisible();
    await expect(grace.page.getByRole("button", { name: /Linus E2E.*Closed/ })).toBeVisible();

    for (const person of people) expect(person.problems).toEqual([]);
  });
});
