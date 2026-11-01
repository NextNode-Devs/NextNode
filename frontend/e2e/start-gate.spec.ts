import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { isConsoleProblem } from "./console";

/**
 * #6 Project start gate, through the UI with one browser per person.
 * Client project: the Team Lead closes a full team's proposal, sends a signed
 * offer (the server's 20 % deposit preview), the client declines with a reason,
 * the Lead revises, the client accepts (Assigned); then #7's verified webhook
 * confirms the deposit and the project is In progress with a team-only
 * workspace chat. Developer idea: close, finalise the timeline, started, with
 * no offer or payment, at every width. Earlier workflows (#3-#5) are set up
 * through the API; their own journeys live in their specs.
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

type Person = { page: Page; userId: string; accountId: number; problems: string[] };

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
  const user = await clerkApi().users.createUser({
    emailAddress: [email],
    firstName: name,
    skipPasswordRequirement: true,
  });
  const page = await (await browser.newContext()).newPage();
  const problems: string[] = [];
  page.on("console", (m) => {
    if (isConsoleProblem(m)) problems.push(m.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  expect((await callApi(page, "POST", "/api/onboarding/", body)).status).toBe(201);
  const me = await callApi(page, "GET", "/api/me/");
  return { page, userId: user.id, accountId: me.body.data.account.id, problems };
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

const isoDay = (daysFromNow: number) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);

/** A refused request is logged by the browser as a console error; that refusal is what the step checks. */
function allowRefusals(person: Person, before: number) {
  person.problems.push(...person.problems.splice(before).filter((problem) => !/status of 40\d/.test(problem)));
}

/** #5's workflow through the API: size 5, four developers apply and the Lead accepts each. */
async function fillTeam(lead: Person, devs: Person[], projectId: number) {
  expect((await callApi(lead.page, "PUT", `/api/projects/${projectId}/team/size/`, { size: 5 })).status).toBe(200);
  for (const dev of devs) {
    const applied = await callApi(dev.page, "POST", `/api/projects/${projectId}/team/applications/`);
    expect(applied.status).toBe(201);
    const accepted = await callApi(lead.page, "POST", `/api/team-applications/${applied.body.data.id}/accept/`);
    expect(accepted.status).toBe(200);
  }
}

/** Stand-in for Stripe calling us: #7's real webhook use case, with a test secret signing the event. */
function confirmDeposit(projectId: number, offerId: number, amountCents: number): string {
  const tag = `${projectId}_${Date.now()}`;
  return django(
    [
      "from nextnode.infrastructure.container import get_container, override_container",
      "from nextnode.infrastructure.payments.stripe_gateway import StripeGateway",
      "from nextnode.infrastructure.persistence.models import PaymentModel",
      "from tests.stripe_helpers import TEST_WEBHOOK_SECRET, checkout_event, sign",
      `p = PaymentModel.objects.create(project_id=${projectId}, offer_version_id=${offerId}, type="deposit", amount_cents=${amountCents}, currency="cad", checkout_session_id="cs_e2e_${tag}")`,
      `payload = checkout_event(str(p.id), event_id="evt_e2e_${tag}", session_id="cs_e2e_${tag}", amount=${amountCents})`,
      "with override_container(payment_gateway=StripeGateway('sk_test_unused', TEST_WEBHOOK_SECRET)):",
      "    print(get_container().handle_payment_webhook.execute(payload, sign(payload)).result)",
    ].join("\n"),
  );
}

const startCard = (page: Page) =>
  page.locator("[data-slot=card]").filter({ has: page.getByRole("heading", { name: "Project start" }) });

test.describe("Project start gate", () => {
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
        "projects = ProjectModel.objects.filter(Q(owner__in=accounts))",
        "PaymentModel.objects.filter(project_id__in=projects.values('id')).delete()",
        "OfferModel.objects.filter(project__in=projects).delete()",
        "ProjectTimelineModel.objects.filter(project__in=projects).delete()",
        "TeamCandidacyModel.objects.filter(Q(lead__in=accounts) | Q(developer__in=accounts)).delete()",
        "LeadCandidacyModel.objects.filter(Q(client__in=accounts) | Q(developer__in=accounts)).delete()",
        "ConversationModel.objects.filter(participants__account__in=accounts).delete()",
        "TeamMembershipModel.objects.filter(team__project__in=projects).delete()",
        "TeamModel.objects.filter(project__in=projects).delete()",
        "projects.delete()",
        "accounts.delete()",
      ].join("\n"),
    );
    for (const person of people) await clerkApi().users.deleteUser(person.userId);
    people = [];
  });

  test("client project: close, offer, decline and revise, accept, then In progress on a confirmed deposit", async ({
    browser,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One many-browser run is enough");
    test.setTimeout(420_000);

    const grace = await signedInPerson(browser, "Grace", client("Grace E2E"));
    const ada = await signedInPerson(browser, "Ada", developer("Ada E2E"));
    const devs = [];
    for (const name of ["Mary", "Linus", "Barbara", "Edsger"])
      devs.push(await signedInPerson(browser, name, developer(`${name} E2E`)));
    const outsider = await signedInPerson(browser, "Alan", developer("Alan E2E"));
    people = [grace, ada, ...devs, outsider];

    const created = await callApi(grace.page, "POST", "/api/projects/", {
      title: "Bakery ordering app",
      description: "Online ordering and pickup slots for a neighbourhood bakery.",
      tech_stack: ["React"],
      target_delivery_date: isoDay(200),
      proposed_budget_cents: 300_000,
    });
    expect(created.status).toBe(201);
    const projectId: number = created.body.data.id;
    const projectPath = `/projects/${projectId}`;
    const applied = await callApi(ada.page, "POST", `/api/projects/${projectId}/lead-applications/`, { note: "" });
    expect((await callApi(grace.page, "POST", `/api/lead-candidacies/${applied.body.data.id}/hire/`)).status).toBe(200);
    await fillTeam(ada, devs, projectId);

    // --- The Lead closes the full team's proposal (asked to confirm first) ---
    await ada.page.goto(projectPath);
    await expect(startCard(ada.page).getByText("Your turn")).toBeVisible();
    await ada.page.getByRole("button", { name: "Close the proposal" }).click();
    await ada.page.getByRole("button", { name: "Yes, close the proposal" }).click();
    await expect(ada.page.getByRole("heading", { name: "Send the client an offer" })).toBeVisible({ timeout: 20_000 });
    await expect(ada.page.getByText("Recruitment has closed.").filter({ visible: true })).toBeVisible();

    // Recruitment is refused with the reason, even through the API.
    let before = outsider.problems.length;
    const late = await callApi(outsider.page, "POST", `/api/projects/${projectId}/team/applications/`);
    expect([late.status, late.body.error.message]).toEqual([409, "Recruitment has closed"]);
    allowRefusals(outsider, before);

    // --- A total below CAD 1,500.00 is refused by the API, bypassing the UI ---
    before = ada.problems.length;
    const tooLow = await callApi(ada.page, "POST", `/api/projects/${projectId}/offers/`, {
      summary: "Everything for very little money.",
      total_cents: 149_999,
      start_date: isoDay(7),
      delivery_date: isoDay(90),
    });
    expect([tooLow.status, tooLow.body.error.fields.total_cents]).toEqual([400, ["Must be at least CAD 1,500.00."]]);
    allowRefusals(ada, before);

    // --- The Lead signs version 1: CAD 10,000.00 shows the server's CAD 2,000.00 deposit ---
    await ada.page.getByLabel(/Estimate summary/).fill("Four sprints: ordering, pickup slots, payments, admin.");
    await ada.page.getByLabel(/Offer total/).fill("10,000");
    await expect(ada.page.getByText("CAD 2,000.00")).toBeVisible();
    await expect(ada.page.getByText(/The client proposed CAD 3,000.00/)).toBeVisible();
    await ada.page.getByLabel(/Start date/).fill(isoDay(7));
    await ada.page.getByLabel(/Delivery date/).fill(isoDay(120));
    await ada.page.getByRole("button", { name: "Sign and send offer" }).click();
    await expect(ada.page.getByRole("heading", { name: "Offer version 1" })).toBeVisible({ timeout: 20_000 });
    await expect(startCard(ada.page).getByText("Client's turn")).toBeVisible();

    // --- The client sees it next to their proposed budget, and declines with a reason ---
    await grace.page.goto(projectPath);
    const graceCard = startCard(grace.page);
    await expect(graceCard.getByText("Your turn")).toBeVisible();
    await expect(graceCard.getByText("Client's proposed budget: CAD 3,000.00")).toBeVisible();
    await expect(graceCard.getByText(/not a legal contract/)).toBeVisible();
    await grace.page.getByRole("button", { name: "Decline…" }).click();
    await grace.page.getByLabel(/Why are you declining/).fill("Our budget is closer to CAD 9,000.");
    await grace.page.getByRole("button", { name: "Decline version 1" }).click();
    await expect(graceCard.getByText("Our budget is closer to CAD 9,000.")).toBeVisible({ timeout: 20_000 });

    // --- The Lead sees the reason and sends a revised version 2 ---
    await ada.page.reload();
    await expect(ada.page.getByRole("heading", { name: "Send a revised offer (version 2)" })).toBeVisible();
    await expect(ada.page.getByText("Our budget is closer to CAD 9,000.")).toBeVisible();
    await ada.page.getByLabel(/Offer total/).fill("9,000");
    await expect(ada.page.getByText("CAD 1,800.00")).toBeVisible();
    await ada.page.getByRole("button", { name: "Sign and send offer" }).click();
    await expect(ada.page.getByRole("heading", { name: "Offer version 2" })).toBeVisible({ timeout: 20_000 });

    // --- The client accepts version 2: Assigned, and the deposit is next ---
    await grace.page.reload();
    await expect(grace.page.getByText("Earlier versions (1)")).toBeVisible();
    await grace.page.getByRole("button", { name: "Accept version 2" }).click();
    await expect(grace.page.getByText("Pay the deposit to start your project")).toBeVisible({ timeout: 20_000 });
    await expect(grace.page.getByText("Assigned", { exact: true })).toBeVisible();

    // A direct start before the deposit is confirmed names what is missing.
    before = grace.problems.length;
    const early = await callApi(grace.page, "POST", `/api/projects/${projectId}/start/`);
    expect(early.status).toBe(409);
    expect(early.body.error.message).toContain("Deposit confirmed by Stripe");
    allowRefusals(grace, before);

    // --- #7: a verified webhook confirms the deposit (20 % of CAD 9,000.00) ---
    const gate = await callApi(grace.page, "GET", `/api/projects/${projectId}/start/`);
    const accepted = gate.body.data.offers[0];
    expect([accepted.status, accepted.deposit_cents]).toEqual(["accepted", 180_000]);
    expect(confirmDeposit(projectId, accepted.id, 180_000)).toContain("completed");

    // --- In progress: every team member gets the workspace chat; the client and others don't ---
    await grace.page.reload();
    await expect(grace.page.getByText("Work has started")).toBeVisible();
    await expect(grace.page.getByRole("link", { name: /team workspace chat/ })).toHaveCount(0);
    await expect(grace.page.getByText("In progress", { exact: true })).toBeVisible();

    await devs[0].page.goto(projectPath);
    await devs[0].page.getByRole("link", { name: /Open the team workspace chat/ }).click();
    await expect(devs[0].page).toHaveURL(/\/conversations\//);
    await expect(devs[0].page.getByText("Team workspace").first()).toBeVisible();
    const workspacePath = new URL(devs[0].page.url()).pathname;
    for (const person of [ada, ...devs.slice(1)]) {
      const mine = await callApi(person.page, "GET", `/api/conversations/${workspacePath.split("/").pop()}/`);
      expect(mine.status).toBe(200);
    }
    for (const person of [grace, outsider]) {
      before = person.problems.length;
      const refused = await callApi(person.page, "GET", `/api/conversations/${workspacePath.split("/").pop()}/`);
      expect(refused.status).toBe(404);
      allowRefusals(person, before);
    }

    for (const person of people) expect(person.problems, `console problems for ${person.accountId}`).toEqual([]);
  });

  test("developer idea: close the proposal, finalise the timeline, started with no offer or payment", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);
    const ada = await signedInPerson(browser, "Ada", developer("Ada E2E"));
    const devs = [];
    for (const name of ["Mary", "Linus", "Barbara", "Edsger"])
      devs.push(await signedInPerson(browser, name, developer(`${name} E2E`)));
    people = [ada, ...devs];
    const width = testInfo.project.use.viewport?.width ?? 1280;
    await ada.page.setViewportSize({ width, height: 900 });

    const created = await callApi(ada.page, "POST", "/api/project-ideas/", {
      title: "Open-source study planner",
      description: "A planner for study groups to share schedules and notes.",
      tech_stack: ["React"],
      target_delivery_date: isoDay(150),
    });
    expect(created.status).toBe(201);
    const projectId: number = created.body.data.id;
    await fillTeam(ada, devs, projectId);

    await ada.page.goto(`/projects/${projectId}`);
    const card = startCard(ada.page);
    await expect(card.getByText(/No payment applies/)).toBeVisible();
    await ada.page.getByRole("button", { name: "Close the proposal" }).click();
    await ada.page.getByRole("button", { name: "Yes, close the proposal" }).click();
    await expect(ada.page.getByRole("heading", { name: "Finalise the timeline" })).toBeVisible({ timeout: 20_000 });

    // The form stays inside the screen at this width.
    const box = await card.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();

    await ada.page.getByLabel(/Start date/).fill(isoDay(3));
    await ada.page.getByRole("button", { name: "Finalise and start the project" }).click();
    await expect(ada.page.getByText("Work has started")).toBeVisible({ timeout: 20_000 });
    await expect(ada.page.getByText("In progress", { exact: true })).toBeVisible();
    await expect(card.getByText(/Offer|Deposit|Pay /)).toHaveCount(0);
    await expect(ada.page.getByRole("link", { name: /Open the team workspace chat/ })).toBeVisible();

    const records = django(
      [
        "from nextnode.infrastructure.persistence.models import OfferModel, PaymentModel",
        `print(OfferModel.objects.filter(project_id=${projectId}).count(), PaymentModel.objects.filter(project_id=${projectId}).count())`,
      ].join("\n"),
    );
    // The shell may print a banner first; the counts are the last line.
    expect(records.split(/\r?\n/).pop()?.trim()).toBe("0 0");
    expect(ada.problems).toEqual([]);
  });
});
