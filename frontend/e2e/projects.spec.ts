import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { isConsoleProblem } from "./console";

/**
 * #3 projects, as two people in two browsers: a client publishes a brief and
 * attaches a requirement PDF, a developer finds it with the filters, sees
 * "Apply to lead" but not the documents; the developer publishes an idea and
 * is shown as its Team Lead. Needs the Clerk development keys (skips without them).
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
    if (isConsoleProblem(m)) problems.push(m.text());
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

async function openReady(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator(".cl-userButtonTrigger")).toBeVisible();
}

async function fitsWidth(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const nextYear = `${new Date().getFullYear() + 1}-06-01`;

async function fillProject(page: Page, title: string, tech: string) {
  await page.getByLabel(/^Title/).fill(title);
  await page.getByLabel(/^(Scope|Description)/).fill("A booking app for a small yoga studio, with payments later.");
  await page.getByRole("combobox", { name: /^Tech stack/ }).fill(tech);
  await page.getByRole("combobox", { name: /^Tech stack/ }).press("Enter");
  await page.getByLabel(/^Target delivery date/).fill(nextYear);
}

test.describe("projects", () => {
  test.skip(!hasClerk, "Needs the Clerk development keys");
  let people: Person[] = [];
  // A technology no other project in the shared local database uses, so the filter finds exactly ours.
  const tech = `E2E${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  test.afterEach(async () => {
    if (people.length === 0) return;
    const ids = people.map((p) => `"${p.userId}"`).join(", ");
    django(
      [
        "from nextnode.infrastructure.persistence.models import *",
        `owners = AccountModel.objects.filter(clerk_user_id__in=[${ids}])`,
        "projects = ProjectModel.objects.filter(owner__in=owners)",
        "RequirementDocumentModel.objects.filter(project__in=projects).delete()",
        "TeamMembershipModel.objects.filter(team__project__in=projects).delete()",
        "TeamModel.objects.filter(project__in=projects).delete()",
        "projects.delete()",
        "owners.delete()",
        `SkillModel.objects.filter(key="${tech.toLowerCase()}").delete()`,
      ].join("\n"),
    );
    for (const person of people) await clerkApi().users.deleteUser(person.userId);
    people = [];
  });

  test("a client publishes a brief a developer finds; a developer publishes an idea as its Lead", async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const grace = await signedInPerson(browser, "Grace", {
      role: "client",
      display_name: "Grace E2E",
      client: { company_name: "Acme", industry: "Retail" },
    });
    const ada = await signedInPerson(browser, "Ada", {
      role: "developer",
      display_name: "Ada E2E",
      developer: { headline: "Backend developer", skills: ["Python"] },
    });
    people = [grace, ada];

    // --- The client publishes a brief from the dashboard ---
    await openReady(grace.page, "/dashboard");
    await grace.page.getByRole("region", { name: "My projects" }).getByRole("link", { name: /Post a project brief/ }).click();
    await expect(grace.page.getByRole("heading", { level: 1, name: "Post a project brief" })).toBeVisible();
    await fillProject(grace.page, "Studio booking app", tech);
    await grace.page.getByLabel(/^Proposed budget/).fill("1000");
    await grace.page.getByRole("button", { name: "Publish brief" }).click();
    await expect(grace.page.getByText("Must be at least CAD 1,500.00.").filter({ visible: true })).toBeVisible();

    await grace.page.getByLabel(/^Proposed budget/).fill("2,500");
    await grace.page.getByRole("button", { name: "Publish brief" }).click();
    await expect(grace.page.getByRole("status").filter({ hasText: "Project published" })).toBeVisible();
    await expect(grace.page.getByRole("heading", { level: 1, name: "Studio booking app" })).toBeVisible();
    await expect(grace.page.getByText("CAD 2,500.00").filter({ visible: true })).toBeVisible();
    const briefUrl = grace.page.url().replace(/\?.*$/, "");

    // A renamed file is refused; a real PDF is accepted.
    const fileInput = grace.page.locator("input[type=file]");
    const before = grace.problems.length;
    await fileInput.setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ not a pdf") });
    await expect(grace.page.getByRole("alert").filter({ hasText: "isn't a real PDF" })).toBeVisible();
    // The browser logs the refused upload (400) as a console error; that refusal is what this step checks.
    const duringRefusal = grace.problems.splice(before);
    grace.problems.push(...duringRefusal.filter((problem) => !/status of 400/.test(problem)));
    await fileInput.setInputFiles({ name: "requirements.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n") });
    await expect(grace.page.getByRole("status").filter({ hasText: "requirements.pdf uploaded." })).toBeVisible();

    // Saved for real: a reload and the dashboard show it.
    await grace.page.goto(briefUrl);
    await expect(grace.page.getByText("requirements.pdf", { exact: true })).toBeVisible();
    await openReady(grace.page, "/dashboard");
    await expect(grace.page.getByRole("region", { name: "My projects" }).getByRole("link", { name: "Studio booking app" })).toBeVisible();

    // --- The developer finds it with the filters ---
    await openReady(ada.page, "/projects");
    await ada.page.getByRole("button", { name: "Client projects" }).click();
    await ada.page.getByRole("combobox", { name: /^Tech stack/ }).fill(tech);
    await ada.page.getByRole("combobox", { name: /^Tech stack/ }).press("Enter");
    await ada.page.getByLabel("Needs a Team Lead").check();
    await expect(ada.page).toHaveURL(new RegExp(`kind=client&tech=${tech}&needs_lead=true`));
    await ada.page.reload(); // the URL reproduces the view
    await ada.page.getByRole("link", { name: "Studio booking app" }).click();
    await expect(ada.page).toHaveURL(briefUrl);
    await expect(ada.page.getByRole("button", { name: "Apply to lead" })).toBeVisible();
    await expect(ada.page.getByText("Requirement documents", { exact: true })).toHaveCount(0); // private
    await expect(ada.page.getByRole("link", { name: "Edit" })).toHaveCount(0);

    // --- The developer publishes an idea and is its Team Lead at once ---
    await ada.page.goto("/projects/new");
    await expect(ada.page.getByRole("heading", { level: 1, name: "Propose a project idea" })).toBeVisible();
    await expect(ada.page.getByLabel(/budget/i)).toHaveCount(0);
    await fillProject(ada.page, "Habit tracker idea", tech);
    await ada.page.getByRole("button", { name: "Publish idea" }).click();
    await expect(ada.page.getByRole("status").filter({ hasText: "Project published" })).toBeVisible();
    await expect(ada.page.getByText("Team Lead:").filter({ visible: true })).toBeVisible();
    await expect(ada.page.getByText("(you)").filter({ visible: true })).toBeVisible();
    await expect(ada.page.locator("body")).not.toContainText(/Proposed budget/);

    // The client sees the idea with no budget and no "Apply to lead".
    await grace.page.goto(`/projects?kind=developer&tech=${tech}`);
    await grace.page.getByRole("link", { name: "Habit tracker idea" }).click();
    await expect(grace.page.getByRole("heading", { level: 1, name: "Habit tracker idea" })).toBeVisible();
    await expect(grace.page.getByRole("button", { name: "Apply to lead" })).toHaveCount(0);
    await expect(grace.page.locator("body")).not.toContainText(/Proposed budget/);

    // An empty search says so.
    await grace.page.goto(`/projects?kind=developer&tech=${tech}&needs_lead=true`);
    await expect(grace.page.getByRole("heading", { name: "No projects match these filters" })).toBeVisible();

    for (const page of [grace.page, ada.page]) {
      await page.goto(briefUrl);
      await fitsWidth(page);
      await page.goto(`/projects?tech=${tech}`);
      await fitsWidth(page);
    }
    expect(ada.problems, `console errors (${testInfo.project.name})`).toEqual([]);
    expect(grace.problems, `console errors (${testInfo.project.name})`).toEqual([]);
  });
});
