import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

import { TEST_EMAIL } from "./test-identity";

/**
 * Checkpoint 23 (#42, #43) — logging an exercise the plan didn't prescribe.
 *
 * Structured logging already existed for *prescribed* exercises. It was gated
 * on the prescription being non-empty, so a Custom-mode session (which
 * prescribes nothing by design) and a freeform lift log could never reach it —
 * both rendered zero set rows. These assertions pin the three entry points the
 * spec says must converge on one form.
 */

async function pick(page: Page, id: string, label: string) {
  await page.locator(`#${id}`).click();
  await page.getByRole("option", { name: label, exact: true }).first().click();
}

async function signIn(page: Page) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });
}

async function addExercise(page: Page, index: number, name: string, reps: string, lbs: string) {
  await page.getByRole("button", { name: "+ Add exercise" }).click();
  const card = page.locator('[data-slot="exercise-card"]').nth(index);
  await card.getByLabel("Exercise name").fill(name);
  await card.getByPlaceholder("Reps").first().fill(reps);
  await card.getByPlaceholder("Lbs").first().fill(lbs);
}

test("a custom-mode lift session can be logged with exercises the plan never prescribed", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signIn(page);

  await page.goto("/intake");
  await page.locator("#raceDate").fill("2027-06-01");
  await page.locator("#currentWeeklyMileage").fill("20");
  await pick(page, "strengthMode", "Custom");
  await page.getByRole("button", { name: "Generate plan" }).click();
  const cont = page.getByRole("link", { name: "Continue to dashboard" });
  if (await cont.isVisible({ timeout: 3000 }).catch(() => false)) await cont.click();
  await expect(page).toHaveURL(/\/dashboard/);

  const liftRow = page
    .locator("li")
    .filter({ has: page.locator("span", { hasText: /^Lift$/ }) })
    .first();
  await liftRow.getByRole("button", { name: "Log this" }).click();
  await expect(page).toHaveURL(/\/log/);

  // The regression: a custom session prescribes nothing, so before this
  // checkpoint there was no way to record what was actually lifted.
  await expect(page.getByText("Nothing prescribed for this session")).toBeVisible();

  await addExercise(page, 0, "Front Squat", "5", "185");
  await addExercise(page, 1, "Pull-up", "8", "0");

  await page.locator("#durationMin").fill("45");
  await page.getByRole("button", { name: "Log session" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/history");
  await expect(page.getByText("2 exercises logged").first()).toBeVisible();
});

test("a prescribed exercise can be removed and one of your own added", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);

  // Builds its own program-mode plan rather than inheriting whatever the
  // previous spec left behind — the suite runs serially against one account,
  // and the test above deliberately switches the plan to custom mode.
  await page.goto("/intake");
  await page.locator("#raceDate").fill("2027-06-01");
  await page.locator("#currentWeeklyMileage").fill("20");
  await pick(page, "strengthMode", "Follow a program");
  await page.getByRole("button", { name: "Generate plan" }).click();
  const cont = page.getByRole("link", { name: "Continue to dashboard" });
  if (await cont.isVisible({ timeout: 3000 }).catch(() => false)) await cont.click();
  await expect(page).toHaveURL(/\/dashboard/);

  const liftRow = page
    .locator("li")
    .filter({ has: page.locator("span", { hasText: /^Lift$/ }) })
    .first();
  await liftRow.getByRole("button", { name: "Log this" }).click();
  await expect(page).toHaveURL(/\/log/);

  const cards = page.locator('[data-slot="exercise-card"]');
  // `count()` does not auto-retry, so wait for the first card to render before
  // counting — otherwise this reads 0 the instant the URL changes.
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  expect(before).toBeGreaterThan(1);

  // Fill the first prescribed exercise so it survives submit, then drop the
  // second entirely.
  await cards.nth(0).getByPlaceholder("Reps").first().fill("6");
  await cards.nth(0).getByPlaceholder("Lbs").first().fill("225");
  await cards.nth(1).getByRole("button", { name: /^Remove/ }).click();
  await expect(cards).toHaveCount(before - 1);

  await addExercise(page, before - 1, "Standing Calf Raise", "12", "90");

  await page.locator("#durationMin").fill("50");
  await page.getByRole("button", { name: "Log session" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Two survive: the prescribed one that was filled, and the added one. The
  // removed one and every unfilled prescribed row are dropped.
  await page.goto("/history");
  await expect(page.getByText("2 exercises logged").first()).toBeVisible();
});

test("a lift with no exercises at all still saves", async ({ page }) => {
  test.setTimeout(120_000);
  await signIn(page);
  await page.goto("/log");

  await pick(page, "type", "Lift");
  // Distance is meaningless for a lift and must not be asked for.
  await expect(page.locator("#distanceMiles")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ Add exercise" })).toBeVisible();

  await page.locator("#durationMin").fill("35");
  await page.getByRole("button", { name: "Log session" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
