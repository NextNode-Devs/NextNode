import { execFileSync } from "node:child_process";

import { createClerkClient } from "@clerk/nextjs/server";
import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

import { isConsoleProblem } from "./console";
import { REAL_STRIPE, sendWebhook } from "./stripe";

/**
 * #7 / #26 The deposit, through the UI. A client project is brought to
 * `Assigned` through the API (#3-#6 have their own journeys); then only the
 * client sees "Pay deposit" with the server's amount, checkout returns to
 * "Confirming payment…" without changing anything, a cancelled or failed
 * payment charges nothing and can be retried, and only a verified webhook
 * confirms the deposit and starts the project.
 *
 * In CI the backend's checkout skips Stripe and this spec sends Stripe's
 * webhook itself, signed (e2e/stripe.ts). With E2E_REAL_STRIPE=1 the last test
 * pays on real Stripe Checkout in test mode instead.
 */
const hasClerk = Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const API = "http://127.0.0.1:8100";
const clerkApi = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

function django(code: string): string {
  const output = execFileSync("uv", ["run", "python", "manage.py", "shell", "-c", code], {
    cwd: "../backend",
    encoding: "utf8",
    env: { ...process.env, DJANGO_SETTINGS_MODULE: "config.settings" },
  }).trim();
  // The shell may print a banner first; the answer is the last line.
  return output.split("\n").pop() ?? "";
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
  return { page, userId: user.id, problems };
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

type Cast = { grace: Person; ada: Person; devs: Person[]; outsider: Person; projectId: number };

/** #3-#6 through the API: a client project with a full, locked team and an accepted CAD 1,500.00 offer. */
async function assignedProject(browser: Browser): Promise<Cast> {
  const grace = await signedInPerson(browser, "Grace", client("Grace E2E"));
  const ada = await signedInPerson(browser, "Ada", developer("Ada E2E"));
  const devs: Person[] = [];
  for (const name of ["Mary", "Linus", "Barbara", "Edsger"])
    devs.push(await signedInPerson(browser, name, developer(`${name} E2E`)));
  const outsider = await signedInPerson(browser, "Alan", developer("Alan E2E"));
  people = [grace, ada, ...devs, outsider];

  const created = await callApi(grace.page, "POST", "/api/projects/", {
    title: "Bakery ordering app",
    description: "Online ordering and pickup slots for a neighbourhood bakery.",
    tech_stack: ["React"],
    target_delivery_date: isoDay(200),
    proposed_budget_cents: 150_000,
  });
  expect(created.status).toBe(201);
  const projectId: number = created.body.data.id;
  const lead = await callApi(ada.page, "POST", `/api/projects/${projectId}/lead-applications/`, { note: "" });
  expect((await callApi(grace.page, "POST", `/api/lead-candidacies/${lead.body.data.id}/hire/`)).status).toBe(200);
  expect((await callApi(ada.page, "PUT", `/api/projects/${projectId}/team/size/`, { size: 5 })).status).toBe(200);
  for (const dev of devs) {
    const applied = await callApi(dev.page, "POST", `/api/projects/${projectId}/team/applications/`);
    const accepted = await callApi(ada.page, "POST", `/api/team-applications/${applied.body.data.id}/accept/`);
    expect(accepted.status).toBe(200);
  }
  expect((await callApi(ada.page, "POST", `/api/projects/${projectId}/close-proposal/`)).status).toBe(200);
  const offer = await callApi(ada.page, "POST", `/api/projects/${projectId}/offers/`, {
    summary: "Two sprints: ordering and pickup slots.",
    total_cents: 150_000,
    start_date: isoDay(7),
    delivery_date: isoDay(90),
  });
  expect(offer.status).toBe(201);
  const offerId: number = offer.body.data.offers[0].id; // the start gate comes back, newest offer first
  expect((await callApi(grace.page, "POST", `/api/offers/${offerId}/accept/`)).status).toBe(200);
  return { grace, ada, devs, outsider, projectId };
}

const payDeposit = (page: Page) => page.getByRole("button", { name: /^(Pay deposit|Try again)$/ });

/** The payment behind the checkout the client was just sent back from. */
function paymentFor(page: Page): { sessionId: string; paymentId: string } {
  const sessionId = new URL(page.url()).searchParams.get("session_id") ?? "";
  expect(sessionId).toMatch(/^cs_/);
  const paymentId = django(
    [
      "from nextnode.infrastructure.persistence.models import PaymentModel",
      `print(PaymentModel.objects.get(checkout_session_id="${sessionId}").id)`,
    ].join("\n"),
  );
  return { sessionId, paymentId };
}

/** Project status, team status and every payment's status, straight from the database. */
function projectState(projectId: number): string {
  return django(
    [
      "from nextnode.infrastructure.persistence.models import PaymentModel, ProjectModel, TeamModel",
      `p = ProjectModel.objects.get(pk=${projectId})`,
      "payments = sorted(PaymentModel.objects.filter(project_id=p.pk).values_list('status', flat=True))",
      "print(p.status, TeamModel.objects.get(project=p).status, payments)",
    ].join("\n"),
  );
}

/** The page fits the screen at this width: no sideways scrolling. */
async function fitsWidth(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

async function fitsPhoneAndTablet(page: Page) {
  for (const width of [375, 768]) await fitsWidth(page, width);
  await page.setViewportSize({ width: 1280, height: 800 });
}

let people: Person[] = [];

test.describe("Project deposit", () => {
  test.skip(!hasClerk, "Needs the Clerk development keys");

  test.afterEach(async () => {
    if (people.length === 0) return;
    for (const person of people) await person.page.context().close();
    const ids = people.map((p) => `"${p.userId}"`).join(", ");
    django(
      [
        "from django.db.models import Q",
        "from nextnode.infrastructure.persistence.models import *",
        `accounts = AccountModel.objects.filter(clerk_user_id__in=[${ids}])`,
        "projects = ProjectModel.objects.filter(owner__in=accounts)",
        "PaymentModel.objects.filter(project_id__in=projects.values('id')).delete()",
        "OfferModel.objects.filter(project__in=projects).delete()",
        "TeamCandidacyModel.objects.filter(Q(lead__in=accounts) | Q(developer__in=accounts)).delete()",
        "LeadCandidacyModel.objects.filter(Q(client__in=accounts) | Q(developer__in=accounts)).delete()",
        "ConversationModel.objects.filter(participants__account__in=accounts).delete()",
        "TeamMembershipModel.objects.filter(team__project__in=projects).delete()",
        "TeamModel.objects.filter(project__in=projects).delete()",
        "projects.delete()",
        "accounts.delete()",
        "print('ok')",
      ].join("\n"),
    );
    for (const person of people) await clerkApi().users.deleteUser(person.userId);
    people = [];
  });

  test("only the client pays; cancel and failure charge nothing; only a verified webhook starts the project", async ({
    browser,
  }, testInfo) => {
    test.skip(REAL_STRIPE, "Covered by the real Stripe Checkout test");
    test.skip(testInfo.project.name !== "desktop", "One many-browser run is enough; widths are checked inside");
    test.setTimeout(420_000);
    const { grace, ada, devs, outsider, projectId } = await assignedProject(browser);
    const projectPath = `/projects/${projectId}`;

    // --- Only the client sees "Pay deposit", with the server's amount: CAD 1,500.00 gives CAD 300.00 ---
    await grace.page.goto(projectPath);
    const payCard = grace.page
      .locator("[data-slot=card]")
      .filter({ hasText: "Pay the deposit to start your project" })
      .last();
    await expect(payCard.getByText("CAD 300.00", { exact: true })).toBeVisible();
    await expect(payCard.getByText("20 % of the accepted offer (CAD 1,500.00)")).toBeVisible();
    await expect(payCard.getByText("Stripe test mode: no real money moves")).toBeVisible();
    await fitsPhoneAndTablet(grace.page);
    for (const person of [ada, devs[0], outsider]) {
      await person.page.goto(projectPath);
      await expect(person.page.getByRole("heading", { name: "Bakery ordering app" })).toBeVisible();
      await expect(payDeposit(person.page)).toHaveCount(0);
    }
    // Anyone but the client: the checkout endpoint refuses, and the return page says so.
    for (const person of [ada, outsider]) {
      const before = person.problems.length;
      expect((await callApi(person.page, "POST", `/api/projects/${projectId}/deposit/checkout/`)).status).toBe(404);
      await person.page.goto(`${projectPath}/deposit/return`);
      await expect(person.page.getByText("You can't view this payment")).toBeVisible();
      allowRefusals(person, before);
    }

    // --- Checkout, then back on the success page: confirming, and nothing changed ---
    await payDeposit(grace.page).click();
    await expect(grace.page).toHaveURL(/\/deposit\/return\?session_id=cs_/, { timeout: 20_000 });
    await expect(grace.page.getByText(/Confirming payment/)).toBeVisible();
    const first = paymentFor(grace.page);
    expect(projectState(projectId)).toBe("Assigned locked ['pending']");
    await fitsPhoneAndTablet(grace.page);

    // --- Cancelled: nothing charged, and "Try again" reopens the same open checkout ---
    await grace.page.goto(`${projectPath}/deposit/cancelled`);
    await expect(grace.page.getByText("Nothing was charged.", { exact: false })).toBeVisible();
    await fitsPhoneAndTablet(grace.page);
    await payDeposit(grace.page).click();
    await expect(grace.page).toHaveURL(new RegExp(`session_id=${first.sessionId}$`), { timeout: 20_000 });

    // --- A forged or mismatched webhook is refused and changes nothing ---
    const completed = { ...first, type: "checkout.session.completed" as const, amountCents: 30_000 };
    expect(await sendWebhook({ ...completed, eventId: `evt_forged_${projectId}` }, "t=1,v1=forged")).toBe(400);
    expect(await sendWebhook({ ...completed, eventId: `evt_amount_${projectId}`, amountCents: 100 })).toBe(400);
    expect(projectState(projectId)).toBe("Assigned locked ['pending']");

    // --- The payment fails: nothing charged, and a retry starts a new checkout ---
    const failed = { ...first, type: "checkout.session.async_payment_failed" as const, amountCents: 30_000 };
    expect(await sendWebhook({ ...failed, eventId: `evt_failed_${projectId}` })).toBe(200);
    await grace.page.reload();
    await expect(grace.page.getByText("The payment didn't go through")).toBeVisible();
    await expect(grace.page.getByText("Nothing was charged.", { exact: false })).toBeVisible();
    await payDeposit(grace.page).click();
    // A new checkout: the return page now names a different session.
    await expect(grace.page).not.toHaveURL(new RegExp(first.sessionId), { timeout: 20_000 });
    const second = paymentFor(grace.page);
    await expect(grace.page.getByText(/Confirming payment/)).toBeVisible();

    // --- Stripe confirms: the waiting page turns to confirmed by itself ---
    const paid = {
      ...second,
      type: "checkout.session.completed" as const,
      amountCents: 30_000,
      eventId: `evt_paid_${projectId}`,
    };
    expect(await sendWebhook(paid)).toBe(200);
    await expect(grace.page.getByText("Deposit confirmed: your team is now active")).toBeVisible({ timeout: 30_000 });
    expect(projectState(projectId)).toBe("InProgress active ['completed', 'failed']");

    // The same event again is processed once: still one completed deposit.
    expect(await sendWebhook(paid)).toBe(200);
    expect(projectState(projectId)).toBe("InProgress active ['completed', 'failed']");

    // --- In progress: no more payment control, and a second deposit is refused ---
    await grace.page.getByRole("link", { name: "Back to the project" }).click();
    await expect(grace.page.getByText("In progress", { exact: true })).toBeVisible();
    await expect(payDeposit(grace.page)).toHaveCount(0);
    const before = grace.problems.length;
    expect((await callApi(grace.page, "POST", `/api/projects/${projectId}/deposit/checkout/`)).status).toBe(409);
    allowRefusals(grace, before);
    await ada.page.goto(projectPath);
    await expect(ada.page.getByRole("link", { name: /Open the team workspace chat/ })).toBeVisible();

    for (const person of people) expect(person.problems, "console problems").toEqual([]);
  });

  test("real Stripe Checkout in test mode: a declined card, then 4242 confirmed by Stripe's webhook", async ({
    browser,
  }, testInfo) => {
    test.skip(!REAL_STRIPE, "Set E2E_REAL_STRIPE=1 and run `stripe listen` (see e2e/stripe.ts)");
    test.skip(testInfo.project.name !== "desktop", "One run is enough");
    test.setTimeout(420_000);
    const { grace, projectId } = await assignedProject(browser);
    const projectPath = `/projects/${projectId}`;
    const stripePage = grace.page;

    await stripePage.goto(projectPath);
    await payDeposit(stripePage).click();
    await expect(stripePage).toHaveURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    await expect(stripePage.getByText("CA$300.00").first()).toBeVisible({ timeout: 30_000 });

    const pay = async (card: string) => {
      await stripePage.locator("#email").fill("grace+clerk_test@example.com");
      // Payment methods are an accordion; the card fields appear once "Card" is chosen.
      // Stripe lays a cover over its button, so the click is dispatched to it directly.
      const cardNumber = stripePage.locator("#cardNumber");
      if (!(await cardNumber.isVisible())) {
        await stripePage.locator("[data-testid=card-accordion-item-button]").dispatchEvent("click");
      }
      await cardNumber.fill(card);
      await stripePage.locator("#cardExpiry").fill("12 / 34");
      await stripePage.locator("#cardCvc").fill("123");
      await stripePage.locator("#billingName").fill("Grace E2E");
      await stripePage.locator("#billingCountry").selectOption("CA");
      const postal = stripePage.locator("#billingPostalCode");
      if (await postal.isVisible()) await postal.fill("M5V 2T6");
      await stripePage.locator("[data-testid=hosted-payment-submit-button]").click();
    };

    // Declined: Stripe says so on its page; nothing is charged and nothing changes here.
    await pay("4000000000000002");
    await expect(stripePage.getByText(/card (was|has been) declined/i).first()).toBeVisible({ timeout: 30_000 });
    expect(projectState(projectId)).toBe("Assigned locked ['pending']");

    // Cancelled with Stripe's own back link: "Nothing was charged", and "Try again" reopens Stripe.
    await stripePage.getByRole("link", { name: /^Back to / }).click();
    await expect(stripePage).toHaveURL(new RegExp(`${projectPath}/deposit/cancelled$`), { timeout: 30_000 });
    await expect(stripePage.getByText("Nothing was charged.", { exact: false })).toBeVisible();
    await payDeposit(stripePage).click();
    await expect(stripePage).toHaveURL(/checkout\.stripe\.com/, { timeout: 30_000 });

    // 4242: Stripe sends the client back to "Confirming…", then its webhook confirms.
    await pay("4242424242424242");
    await expect(stripePage).toHaveURL(/\/deposit\/return\?session_id=cs_test_/, { timeout: 60_000 });
    await expect(stripePage.getByText("Deposit confirmed: your team is now active")).toBeVisible({
      timeout: 60_000,
    });
    expect(projectState(projectId)).toBe("InProgress active ['completed']");
  });
});
