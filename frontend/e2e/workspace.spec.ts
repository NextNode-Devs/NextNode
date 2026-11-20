import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { isConsoleProblem } from "./console";

/**
 * #92 Workspace tabs (Phase 2 prototype), through the UI at every width: the
 * client, the hired Team Lead and a developer outside the project each get the
 * tabs (or not) that fit them. Meetings and Updates show sample data; their
 * actions say they are under construction. Needs the Clerk development keys.
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

test.describe("Workspace tabs", () => {
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

  test("client, Team Lead and outsider each get the right tabs", async ({ browser }) => {
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
      title: "Workspace tabs project",
      description: "A booking app for a small yoga studio, with payments later.",
      tech_stack: ["React"],
      target_delivery_date: `${new Date().getFullYear() + 1}-06-01`,
      proposed_budget_cents: 300_000,
    });
    expect(created.status).toBe(201);
    const projectPath = `/projects/${created.body.data.id}`;
    const applied = await callApi(ada.page, "POST", `${projectPath.replace("/projects", "/api/projects")}/lead-applications/`, { note: "" });
    expect((await callApi(grace.page, "POST", `/api/lead-candidacies/${applied.body.data.id}/hire/`)).status).toBe(200);

    // --- The client: every tab but the team's chat, starting on Overview ---
    await grace.page.goto(projectPath);
    const tabs = grace.page.getByRole("navigation", { name: "Project sections" });
    await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("link")).toHaveText(["Overview", "Documents", "Meetings", "Updates", "Payments"]);

    await tabs.getByRole("link", { name: "Meetings" }).click();
    // A tab is a server-rendered page: under a full parallel run it can take more than the default 5 s.
    await expect(grace.page).toHaveURL(new RegExp(`${projectPath}/meetings$`), { timeout: 20_000 });
    await expect(tabs.getByRole("link", { name: "Meetings" })).toHaveAttribute("aria-current", "page");
    await expect(grace.page.getByText("Prototype screen")).toBeVisible();
    await expect(grace.page.getByText("Weekly stand-up")).toBeVisible();
    await expect(grace.page.getByRole("heading", { name: "Add a link" })).toBeVisible(); // the client adds meetings too
    await noSidewaysScroll(grace.page);

    await tabs.getByRole("link", { name: "Updates" }).click();
    await expect(grace.page.getByRole("heading", { name: /^Milestone 2/ })).toBeVisible({ timeout: 20_000 });
    await hydrated(grace.page);
    await grace.page.getByRole("button", { name: "Post" }).click();
    await expect(grace.page.getByText("Write something before posting.")).toBeVisible();
    await grace.page.getByLabel("Post an update").fill("The designs look great.");
    await grace.page.getByRole("button", { name: "Post" }).click();
    await expect(grace.page.getByRole("status").filter({ hasText: "This is a prototype" })).toBeVisible();
    await noSidewaysScroll(grace.page);

    await tabs.getByRole("link", { name: "Documents" }).click();
    await expect(grace.page.getByRole("heading", { name: "Requirement documents" })).toBeVisible({ timeout: 20_000 });

    // --- The Team Lead: the chat waits for work to start; they add meetings too ---
    await ada.page.goto(`${projectPath}/chat`);
    await expect(ada.page.getByRole("heading", { name: "The team chat opens when work starts" })).toBeVisible();
    await ada.page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Meetings" }).click();
    await expect(ada.page.getByRole("heading", { name: "Add a link" })).toBeVisible({ timeout: 20_000 });
    await hydrated(ada.page);
    await ada.page.getByRole("radio", { name: "Recurring" }).click();
    await expect(ada.page.getByRole("group", { name: /Days/ })).toBeVisible();
    await ada.page.getByLabel(/^Name/).fill("Sprint review");
    await ada.page.getByLabel(/^Meeting link/).fill("https://meet.google.com/abc-defg-hij");
    await ada.page.getByRole("checkbox", { name: "Thu" }).click();
    await ada.page.getByLabel(/^Time/).fill("10:00");
    await ada.page.getByRole("button", { name: "Add link" }).click();
    await expect(ada.page.getByRole("status").filter({ hasText: "This is a prototype" })).toBeVisible();
    await noSidewaysScroll(ada.page);

    // --- A developer outside the project: Overview only, and a typed link is refused ---
    await mary.page.goto(projectPath);
    await expect(mary.page.getByRole("heading", { level: 1, name: "Workspace tabs project" })).toBeVisible();
    await expect(mary.page.getByRole("navigation", { name: "Project sections" })).toHaveCount(0);
    await expect(mary.page.getByText(/private to its client and team. You'll see it if you join the team./)).toBeVisible();
    await mary.page.goto(`${projectPath}/updates`);
    await expect(mary.page.getByRole("heading", { name: "Only the client and team can see this" })).toBeVisible();
    await expect(mary.page.getByText("Weekly stand-up")).toHaveCount(0);

    for (const person of people) expect(person.problems).toEqual([]);
  });
});
