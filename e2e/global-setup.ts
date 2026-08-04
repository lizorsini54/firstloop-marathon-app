import { clerkSetup } from "@clerk/testing/playwright";
import type { FullConfig } from "@playwright/test";

import { assertIdentityIsSafeFor } from "./test-identity";

export default async function globalSetup(config: FullConfig) {
  // Before Clerk is touched, so an unsafe target fails in a second rather than
  // after a round trip to Clerk's API.
  assertIdentityIsSafeFor(config.projects[0]?.use.baseURL);
  await clerkSetup();
}
