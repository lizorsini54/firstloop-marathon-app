import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { TEST_EMAIL } from "./test-identity";

/**
 * Regression test for the Checkpoint 17 bug.
 *
 * The dashboard's "Log this" action was gated on `w.type === "LIFT"` from
 * Checkpoint 9 through 16, so every run — including the long run, the most
 * important session in the week — had no way to be logged against its planned
 * workout. Nothing caught it: types were fine, every test passed, and a
 * persona-driven product review missed it too. It only surfaced when someone
 * clicked the thing.
 *
 * The cost was downstream and invisible in the demo. `buildTrainingSnapshot`
 * decides what a runner missed by checking each log's `plannedWorkoutId`, so a
 * runner logging every run through the generic form (the only route they had)
 * would have been told they missed all of them. The seed script sets that link
 * directly, which is exactly why eight weeks of seeded history never showed it.
 *
 * What this pins, and what it doesn't: the assertions below prove the action is
 * offered on a run row and that the plan's prescription travels with the click.
 * The prefilled duration is the observable proxy for that — it can only arrive
 * from the same router state object that carries `plannedWorkoutId`. The
 * persisted foreign key itself is not asserted here; that would need database
 * access Playwright doesn't have.
 */

test("a planned run can be logged from its own row on the dashboard", async ({ page }) => {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });

  // Creates its own plan rather than depending on another spec having run
  // first — CI starts from a migrated but unseeded database.
  await page.goto("/intake");
  await page.locator("#raceDate").fill("2027-08-01");
  await page.locator("#currentWeeklyMileage").fill("20");
  await page.getByRole("button", { name: "Generate plan" }).click();

  const continueLink = page.getByRole("link", { name: "Continue to dashboard" });
  if (await continueLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueLink.click();
  }
  await expect(page).toHaveURL(/\/dashboard/);

  // Day order is Monday-first and the long run lands on Sunday, so the first
  // Run row is always one prescribed by duration rather than distance.
  const runRow = page
    .locator("li")
    .filter({ has: page.locator("span", { hasText: /^Run$/ }) })
    .first();
  await expect(runRow).toBeVisible();

  // The regression itself: this button did not exist on run rows.
  const logThis = runRow.getByRole("button", { name: "Log this" });
  await expect(logThis).toBeVisible();

  // A rest day is the one row that should still offer nothing — the fix
  // widened the gate to "not REST", it didn't remove it.
  const restRow = page
    .locator("li")
    .filter({ has: page.locator("span", { hasText: /^Rest$/ }) })
    .first();
  if (await restRow.isVisible().catch(() => false)) {
    await expect(restRow.getByRole("button", { name: "Log this" })).toHaveCount(0);
  }

  await logThis.click();
  await expect(page).toHaveURL(/\/log/);

  // The prescription travelled with the click: the type is preselected and the
  // planned duration is prefilled rather than left for the runner to retype.
  await expect(page.getByRole("combobox", { name: "Type" })).toHaveText("Run");
  await expect(page.locator("#durationMin")).toHaveValue(/^[1-9]\d*$/);

  // Distance stays empty on purpose. The plan prescribes this run by duration
  // and has no distance to offer, which the app declines to invent.
  await expect(page.locator("#distanceMiles")).toHaveValue("");

  const plannedDuration = await page.locator("#durationMin").inputValue();

  await page.getByRole("button", { name: "Log session" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(`${plannedDuration}min`).first()).toBeVisible();
});
