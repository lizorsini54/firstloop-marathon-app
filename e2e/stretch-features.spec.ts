import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { TEST_EMAIL } from "./test-identity";

test("fueling reference renders its guidance tiers", async ({ page }) => {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });

  await page.goto("/nutrition");

  await expect(page.getByRole("heading", { name: "Fueling", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Under 60 min" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Over 2:30" })).toBeVisible();
  await expect(page.getByText("60–90 g / hour")).toBeVisible();
  await expect(page.getByText("Nothing new on race day", { exact: false })).toBeVisible();

  await page.screenshot({ path: "e2e/screenshots/nutrition.png", fullPage: true });
});

test("coach card resolves to a definite state when asked", async ({ page }) => {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });

  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Coach" })).toBeVisible();
  const ask = page.getByRole("button", { name: "Ask the coach" });
  await expect(ask).toBeVisible();

  await ask.click();

  // Asserted key-agnostically: with ANTHROPIC_API_KEY set the card shows
  // guidance, without it the unavailable copy. Either way the request must
  // settle — the button returning to an enabled "Ask again" is the signal, and
  // a coach outage must never leave the dashboard stuck loading.
  const askAgain = page.getByRole("button", { name: "Ask again" });
  await expect(askAgain).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByText("Thinking…")).toHaveCount(0);

  await page.screenshot({ path: "e2e/screenshots/dashboard-coach.png", fullPage: true });
});
