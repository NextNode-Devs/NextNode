import { expect, test } from "@playwright/test";

import { isConsoleProblem } from "./console";

test("home renders, reaches the backend, and logs no console errors", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (isConsoleProblem(message)) problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "NextNode" })).toBeVisible();

  // The health card resolves from its loading state to real backend values.
  const card = page.getByText("Backend connection").locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(card.getByText("Database")).toBeVisible();
  await expect(card.getByText("API").locator("xpath=following-sibling::dd")).toHaveText(/ok/i);
  await expect(card.getByText("Database").locator("xpath=following-sibling::dd")).toHaveText(/ok/i);

  // No horizontal scroll at this viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  expect(problems).toEqual([]);
});
