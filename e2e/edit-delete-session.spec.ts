import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

import { TEST_EMAIL } from "./test-identity";

/**
 * Checkpoint 27 (#10, session half). `logSession` only ever created, so a typo
 * in a distance was permanent — and it feeds the dashboard totals, the progress
 * charts and the coach's adherence numbers.
 *
 * Editing reuses the log form rather than adding a second one, so these also
 * pin that the form prefills from what history already returned.
 */

async function signIn(page: Page) {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });
}

/**
 * Durations unlikely to collide with the seeded history or with a previous run
 * of this spec — the suite shares one account, and an assertion that a row is
 * *gone* will otherwise match a leftover from last time. Same reasoning as
 * golden-path.spec.ts's DISTINCTIVE_DURATION.
 */
const UNIQUE = 10_000 + (Date.now() % 80_000);
const EDIT_DURATION = String(UNIQUE);
const DELETE_DURATION = String(UNIQUE + 1);

/**
 * Logs a run with an unmistakable duration so the assertions can find its row.
 *
 * Waits only for the form to be left behind, deliberately not for `/dashboard`:
 * CI runs against a migrated but unseeded database, where there is no plan, and
 * Checkpoint 17 routes a plan-less user straight on to `/intake`. Asserting the
 * destination would pin seeded state these tests do not otherwise need — what
 * matters is that the submit went through, which the history row then proves.
 */
async function logRun(page: Page, distance: string, duration: string) {
  await page.goto("/log");
  await page.locator("#distanceMiles").fill(distance);
  await page.locator("#durationMin").fill(duration);
  await page.getByRole("button", { name: "Log session" }).click();
  await expect(page).not.toHaveURL(/\/log/);
}

test("a logged session can be corrected after the fact", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);
  await logRun(page, "3.7", EDIT_DURATION);

  await page.goto("/history");
  const row = page.locator("li").filter({ hasText: `3.7mi · ${EDIT_DURATION}min` }).first();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /^Edit session/ }).click();
  await expect(page).toHaveURL(/\/log/);

  // Prefilled from history — the point of reusing this form.
  // CardTitle renders a div, not an h*, so this is a text assertion rather
  // than a heading role.
  await expect(page.locator('[data-slot="card-title"]')).toHaveText("Edit session");
  await expect(page.locator("#distanceMiles")).toHaveValue("3.7");
  await expect(page.locator("#durationMin")).toHaveValue(EDIT_DURATION);

  await page.locator("#distanceMiles").fill("5.2");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/history/);

  await expect(
    page.locator("li").filter({ hasText: `5.2mi · ${EDIT_DURATION}min` }).first(),
  ).toBeVisible();
  await expect(page.locator("li").filter({ hasText: `3.7mi · ${EDIT_DURATION}min` })).toHaveCount(0);
});

test("a logged session can be deleted, behind a confirm", async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page);
  await logRun(page, "9.4", DELETE_DURATION);

  await page.goto("/history");
  const row = page.locator("li").filter({ hasText: `9.4mi · ${DELETE_DURATION}min` }).first();
  await expect(row).toBeVisible();

  // First click only arms it — a single misclick must not destroy an entry.
  await row.getByRole("button", { name: /^Delete session/ }).click();
  await expect(page.getByText("Delete this session?")).toBeVisible();
  await expect(page.locator("li").filter({ hasText: `9.4mi · ${DELETE_DURATION}min` })).toHaveCount(1);

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Delete this session?")).toHaveCount(0);
  await expect(page.locator("li").filter({ hasText: `9.4mi · ${DELETE_DURATION}min` })).toHaveCount(1);

  await row.getByRole("button", { name: /^Delete session/ }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.locator("li").filter({ hasText: `9.4mi · ${DELETE_DURATION}min` })).toHaveCount(0);
});
