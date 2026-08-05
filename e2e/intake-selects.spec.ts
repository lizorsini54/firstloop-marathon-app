import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

import { TEST_EMAIL } from "./test-identity";

/**
 * Regression test for the Checkpoint 21 bug (#44).
 *
 * Selecting 0 bike days left the trigger completely blank. Radix renders the
 * trigger's text by portalling the selected item's children into the value
 * node, and that portal drops a bare numeric `0` — the option list showed "0"
 * correctly, so only the *selected* state was affected. It mattered because 0
 * bike days is the seeded demo's own configuration and one of only two clean
 * day-economy setups: the recommended value was the one that rendered as
 * nothing.
 *
 * Asserting the trigger's text rather than the form's submitted value on
 * purpose — the value was always correct, which is exactly why nothing caught
 * this. Only what the user could see was wrong.
 */
test("every day-count select shows the value that is selected, including zero", async ({
  page,
}) => {
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: TEST_EMAIL });
  await page.goto("/intake");

  const bike = page.locator("#bikeDaysPerWeek");
  await expect(bike).toBeVisible();

  // Zero first: the case that was broken.
  for (const value of ["0", "3", "0", "7"]) {
    await bike.click();
    await page.getByRole("option", { name: value, exact: true }).first().click();
    await expect(bike).toHaveText(value);
  }

  // The other two numeric selects have no zero in their options today, so they
  // never showed the bug — they carry the same fix so that adding one can't
  // reintroduce it. Spot-check they still render normally.
  const running = page.locator("#runningDaysPerWeek");
  await running.click();
  await page.getByRole("option", { name: "5", exact: true }).first().click();
  await expect(running).toHaveText("5");
});
