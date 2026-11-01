import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * #5 Hire Devs, through the UI with one browser per person. A Team Lead sets the
 * size, invites one developer (who accepts) and accepts three applications; the
 * team fills and a further applicant's conversation closes live. The start of
 * the same flow then runs on a developer-created project, at every width.
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

type Person = { page: Page; userId: string; name: string; accountId: number; problems: string[] };

/** A call to the API as the page's signed-in user (setup only; people act through the UI). */
async function callApi(page: Page, method: string, path: string, body?: object) {
  // A page that just opened may not have loaded Clerk's session yet.
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
    if (m.type() === "error" || /hydrat/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  // Onboarding has its own journey (auth.spec.ts); here it's set up through the API.
  const onboarded = await callApi(page, "POST", "/api/onboarding/", body);
  expect(onboarded.status).toBe(201);
  const me = await callApi(page, "GET", "/api/me/");
  return { page, userId: user.id, name, accountId: me.body.data.account.id, problems };
}

const developer = (name: string) => ({
  role: "developer",
  display_name: name,
  developer: { headline: "Full-stack developer", bio: "", github_username: null, skills: ["React"] },
});

const client = (name: string) => ({
  role: "client",
  display_name: name,
  client: { company_name: "Acme", industry: "Retail" },
});

/** The browser logs a refused request as a console error; that refusal is what the step checks. */
function allowRefusals(person: Person, before: number) {
  person.problems.push(...person.problems.splice(before).filter((problem) => !/status of 40\d/.test(problem)));
}

test.describe("Hire Devs", () => {
  test.skip(!hasClerk, "Needs the Clerk development keys");
  let people: Person[] = [];

  test.afterEach(async () => {
    if (people.length === 0) return;
    // Open pages keep their sockets reconnecting, which slows the later specs on this worker.
    for (const person of people) await person.page.context().close();
    // The e2e backend shares the local database: remove everything these accounts made.
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
        "RequirementDocumentModel.objects.filter(project__in=projects).delete()",
        "TeamMembershipModel.objects.filter(team__project__in=projects).delete()",
        "TeamModel.objects.filter(project__in=projects).delete()",
        "projects.delete()",
        "accounts.delete()",
      ].join("\n"),
    );
    for (const person of people) await clerkApi().users.deleteUser(person.userId);
    people = [];
  });

  test("size 5: one invitation accepted, three applications accepted, full, a further applicant closes live", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One many-browser run is enough");
    test.setTimeout(420_000);

    const grace = await signedInPerson(browser, "Grace", client("Grace E2E"));
    const ada = await signedInPerson(browser, "Ada", developer("Ada E2E"));
    const mary = await signedInPerson(browser, "Mary", developer("Mary E2E"));
    const applicants = [
      await signedInPerson(browser, "Linus", developer("Linus E2E")),
      await signedInPerson(browser, "Barbara", developer("Barbara E2E")),
      await signedInPerson(browser, "Edsger", developer("Edsger E2E")),
    ];
    const late = await signedInPerson(browser, "Late", developer("Late E2E"));
    people = [grace, ada, mary, ...applicants, late];

    // A posted brief with a hired Lead: those journeys are #3's and #4's.
    const created = await callApi(grace.page, "POST", "/api/projects/", {
      title: "Yoga studio bookings",
      description: "A booking app for a small yoga studio, with payments later.",
      tech_stack: ["React"],
      target_delivery_date: `${new Date().getFullYear() + 1}-06-01`,
      proposed_budget_cents: 300_000,
    });
    expect(created.status).toBe(201);
    const projectId = created.body.data.id;
    const projectPath = `/projects/${projectId}`;
    const applied = await callApi(ada.page, "POST", `/api/projects/${projectId}/lead-applications/`, { note: "" });
    expect(applied.status).toBe(201);
    const hired = await callApi(grace.page, "POST", `/api/lead-candidacies/${applied.body.data.id}/hire/`);
    expect(hired.status).toBe(200);

    // A private requirement document, uploaded by the client (AC9 checks who can read it).
    await grace.page.goto(projectPath);
    await grace.page
      .locator("input[type=file]")
      .setInputFiles({ name: "requirements.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\n") });
    const uploaded = grace.page.getByRole("status").filter({ hasText: "requirements.pdf uploaded." });
    await expect(uploaded).toBeVisible();

    // --- Nobody can apply before the Lead sets a size ---
    await mary.page.goto(projectPath);
    await expect(mary.page.getByRole("heading", { level: 1, name: "Yoga studio bookings" })).toBeVisible();
    await expect(mary.page.getByRole("button", { name: "Apply to join" })).toHaveCount(0);

    // --- The Lead sets the size; a size outside the rule is refused with the rule named ---
    await ada.page.goto(projectPath);
    await ada.page.getByRole("radio", { name: "5", exact: true }).click();
    await ada.page.getByRole("button", { name: "Open the spots" }).click();
    await expect(ada.page.getByText("1 of 5 people · 4 open spots").filter({ visible: true })).toBeVisible({ timeout: 20_000 });
    const before = ada.problems.length;
    const refused = await callApi(ada.page, "PUT", `/api/projects/${projectId}/team/size/`, { size: 4 });
    expect(refused.status).toBe(400);
    expect(refused.body.error.message).toContain("5 to 7 people including the Team Lead");
    allowRefusals(ada, before);

    // --- The Lead invites Mary from her portfolio and lands in the new conversation ---
    await ada.page.goto(`/developers/${mary.accountId}`);
    await ada.page.getByRole("button", { name: /Invite to my team/ }).click();
    await expect(ada.page.getByRole("radio", { name: /Yoga studio bookings/ })).toBeChecked();
    await ada.page.getByRole("button", { name: "Send invitation" }).click();
    await expect(ada.page).toHaveURL(/\/conversations\//);
    const adaDecision = ada.page.getByRole("region", { name: "Team decision" });
    await expect(adaDecision.getByRole("status")).toContainText("Waiting for Mary E2E");
    await expect(ada.page.getByRole("button", { name: "Accept invitation" })).toHaveCount(0); // the Lead can't accept for her

    // --- Mary isn't on the team until she accepts, from her dashboard's Invitations ---
    await mary.page.goto(projectPath);
    await expect(mary.page.getByRole("list", { name: "Team members" }).getByRole("link", { name: "Mary E2E" })).toHaveCount(0);
    await expect(mary.page.getByText("requirements.pdf", { exact: true })).toHaveCount(0);
    await expect(mary.page.getByRole("status").filter({ hasText: "invited you" })).toBeVisible();
    await mary.page.goto("/dashboard");
    await mary.page.getByRole("region", { name: "Invitations" }).getByRole("link", { name: /Yoga studio bookings/ }).click();
    await mary.page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(mary.page.getByRole("status").filter({ hasText: "You're on this team." })).toBeVisible();
    await expect(adaDecision.getByRole("status")).toContainText("Mary E2E joined your team", { timeout: 20_000 });

    // --- Developers apply on the project's page, the further applicant too ---
    for (const person of [...applicants, late]) {
      await person.page.goto(projectPath);
      await person.page.getByRole("button", { name: "Apply to join" }).click();
      await expect(person.page.getByRole("status").filter({ hasText: "Application sent" })).toBeVisible();
    }

    // A second application is refused; so is a client's.
    const beforeSecond = late.problems.length;
    expect((await callApi(late.page, "POST", `/api/projects/${projectId}/team/applications/`)).status).toBe(409);
    allowRefusals(late, beforeSecond);
    const beforeClient = grace.problems.length;
    expect((await callApi(grace.page, "POST", `/api/projects/${projectId}/team/applications/`)).status).toBe(403);
    allowRefusals(grace, beforeClient);

    // The further applicant watches their conversation.
    await late.page.getByRole("link", { name: "Open the conversation" }).click();
    await expect(late.page).toHaveURL(/\/conversations\//);
    await expect(late.page.getByRole("region", { name: "Team decision" }).getByRole("status")).toContainText(
      "You've applied to join",
    );

    // --- The Lead accepts three applications from the dashboard's Applications ---
    for (const person of applicants) {
      await ada.page.goto("/dashboard");
      await ada.page.getByRole("region", { name: "Applications" }).getByRole("link", { name: new RegExp(person.name) }).click();
      await expect(ada.page).toHaveURL(/\/conversations\//);
      await ada.page.getByRole("button", { name: "Accept application" }).click();
      await expect(ada.page.getByRole("status").filter({ hasText: `${person.name} E2E joined your team` })).toBeVisible();
    }

    // --- The team is full: the further applicant's conversation closes live, with the reason ---
    await expect(late.page.getByText("This conversation is closed")).toBeVisible({ timeout: 20_000 });
    await expect(late.page.getByText("The team is full").first()).toBeVisible();
    await expect(late.page.getByRole("textbox", { name: "Message" })).toHaveCount(0);

    // A new member's conversation stays open.
    await applicants[0].page.goto("/dashboard");
    await applicants[0].page.getByRole("region", { name: "Applications" }).getByRole("link", { name: /Yoga studio bookings/ }).click();
    await expect(applicants[0].page.getByText("You're on this team.")).toBeVisible();
    await expect(applicants[0].page.getByRole("textbox", { name: "Message" })).toBeVisible();

    // --- It persists: the profile on the project page, for the client and everyone signed in ---
    await grace.page.goto(projectPath);
    const roster = grace.page.getByRole("list", { name: "Team members" }).getByRole("listitem");
    await expect(roster).toHaveCount(5);
    await expect(roster.first()).toContainText("Ada E2E");
    await expect(roster.first()).toContainText("Team Lead");
    await expect(grace.page.getByText("5 of 5 people. The team is full.").filter({ visible: true })).toBeVisible();
    await grace.page.getByRole("link", { name: "Linus E2E" }).click();
    await expect(grace.page.getByRole("heading", { level: 1, name: "Linus E2E" })).toBeVisible();

    // --- A member reads the requirement documents; the applicant who didn't get in cannot ---
    await applicants[0].page.goto(projectPath);
    await expect(applicants[0].page.getByText("requirements.pdf", { exact: true })).toBeVisible();
    const documents = await callApi(applicants[0].page, "GET", `/api/projects/${projectId}/documents/`);
    expect(documents.status).toBe(200);
    const link = await callApi(
      applicants[0].page,
      "GET",
      `/api/projects/${projectId}/documents/${documents.body.data[0].id}/link/`,
    );
    expect(link.status).toBe(200);
    await late.page.goto(projectPath);
    await expect(late.page.getByRole("heading", { level: 1, name: "Yoga studio bookings" })).toBeVisible();
    await expect(late.page.getByText("requirements.pdf", { exact: true })).toHaveCount(0);
    await expect(late.page.getByRole("button", { name: "Apply to join" })).toHaveCount(0);

    // A full team refuses anyone new.
    const beforeFull = late.problems.length;
    const full = await callApi(late.page, "POST", `/api/projects/${projectId}/team/invitations/`, {
      developer_account_id: late.accountId,
    });
    expect(full.status).toBe(403); // not the Lead
    const applyFull = await callApi(ada.page, "POST", `/api/projects/${projectId}/team/invitations/`, {
      developer_account_id: late.accountId,
    });
    expect(applyFull.status).toBe(409);
    allowRefusals(late, beforeFull);
    ada.problems.splice(0, ada.problems.length, ...ada.problems.filter((problem) => !/status of 40\d/.test(problem)));

    for (const person of people) expect(person.problems).toEqual([]);
  });

  test("the same start on a developer's own project, and a locked team refuses with the reason", async ({ browser }) => {
    test.setTimeout(180_000);
    const ada = await signedInPerson(browser, "Ada", developer("Ada E2E"));
    const linus = await signedInPerson(browser, "Linus", developer("Linus E2E"));
    const mary = await signedInPerson(browser, "Mary", developer("Mary E2E"));
    people = [ada, linus, mary];

    const idea = await callApi(ada.page, "POST", "/api/project-ideas/", {
      title: "Open source habit tracker",
      description: "A small habit tracker that the team builds for its portfolio.",
      tech_stack: ["React"],
      target_delivery_date: `${new Date().getFullYear() + 1}-06-01`,
    });
    expect(idea.status).toBe(201);
    const projectId = idea.body.data.id;
    const projectPath = `/projects/${projectId}`;

    // --- The creator is the Lead, and sets the size ---
    await ada.page.goto(projectPath);
    await expect(ada.page.getByRole("list", { name: "Team members" })).toContainText("Team Lead");
    await ada.page.getByRole("radio", { name: "6", exact: true }).click();
    await ada.page.getByRole("button", { name: "Open the spots" }).click();
    await expect(ada.page.getByText("1 of 6 people · 5 open spots").filter({ visible: true })).toBeVisible({ timeout: 20_000 });

    // --- A developer applies; the Lead sees it live on the dashboard and accepts ---
    await ada.page.goto("/dashboard");
    const applications = ada.page.getByRole("region", { name: "Applications" });
    await expect(applications.getByText(/No applications to join a team yet/)).toBeVisible();
    await linus.page.goto(projectPath);
    await linus.page.getByRole("button", { name: "Apply to join" }).click();
    await expect(linus.page.getByRole("status").filter({ hasText: "Application sent" })).toBeVisible();
    await applications.getByRole("link", { name: /Linus E2E/ }).click({ timeout: 20_000 });
    await ada.page.getByRole("button", { name: "Accept application" }).click();
    await expect(ada.page.getByRole("status").filter({ hasText: "Linus E2E joined your team" })).toBeVisible();

    await linus.page.goto(projectPath);
    await expect(linus.page.getByRole("list", { name: "Team members" }).getByRole("listitem")).toHaveCount(2);
    await expect(linus.page.getByText("2 of 6 people · 4 open spots").filter({ visible: true })).toBeVisible();
    await expect(linus.page.getByRole("button", { name: "Apply to join" })).toHaveCount(0);

    // --- #6 locks a team: the page says so, and applying and inviting are refused with the reason ---
    django(
      [
        "from nextnode.infrastructure.persistence.models import TeamModel",
        `TeamModel.objects.filter(project_id=${projectId}).update(status="locked")`,
      ].join("\n"),
    );
    await mary.page.goto(projectPath);
    await expect(mary.page.getByText(/Recruitment has closed/).filter({ visible: true })).toBeVisible();
    await expect(mary.page.getByRole("button", { name: "Apply to join" })).toHaveCount(0);
    const before = mary.problems.length;
    const refused = await callApi(mary.page, "POST", `/api/projects/${projectId}/team/applications/`);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe("Recruitment has closed");
    allowRefusals(mary, before);

    for (const person of people) expect(person.problems).toEqual([]);
  });
});
