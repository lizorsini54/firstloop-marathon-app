import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { TEST_EMAIL } from "./test-identity";

// A duration unlikely to collide with any other logged session, so the
// dashboard assertion below (which only renders date/type/duration/RPE,
// not notes) can look for an unambiguous, run-specific value.
const DISTINCTIVE_DURATION = String(10_000 + (Date.now() % 80_000));

test("golden path: sign in, create a plan, log a run, see it on the dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });

  await page.goto("/intake");
  await page.locator("#raceDate").fill("2027-06-01");
  await page.locator("#currentWeeklyMileage").fill("20");
  await page.getByRole("button", { name: "Generate plan" }).click();

  const continueLink = page.getByRole("link", { name: "Continue to dashboard" });
  if (await continueLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueLink.click();
  }
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Log a session" }).click();
  await expect(page).toHaveURL(/\/log/);

  await page.locator("#durationMin").fill(DISTINCTIVE_DURATION);
  await page.getByRole("button", { name: "Log session" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(`${DISTINCTIVE_DURATION}min`)).toBeVisible();
});
