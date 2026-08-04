/**
 * Which Clerk identity the specs sign in as, and a guard on where that
 * identity is allowed to be used.
 *
 * The demo account is a curated fixture: the seed script gives it ~8 weeks of
 * training history, and that history is what makes the deployed app
 * demonstrable at any moment. Every spec here calls `createPlan`, and the app
 * resolves "most recent plan wins" — so a single e2e run buries the seeded
 * persona under a plan generated that day with no history behind it. That is
 * harmless against localhost (CI starts from an ephemeral database, and a
 * local run is one `db:seed` away from clean) and destructive against any
 * shared environment.
 *
 * Rather than depend on remembering that, `assertIdentityIsSafeFor` refuses to
 * run against a non-local `baseURL` unless `E2E_CLERK_EMAIL` names a separate
 * Clerk test user. The demo account therefore can only ever be written to by a
 * local run or by the seed script itself.
 *
 * Any address carrying the `+clerk_test` subaddress is a test identity on a
 * Clerk development instance, so a dedicated account costs nothing but needs
 * to exist in Clerk before it can be signed in as.
 */

const DEMO_EMAIL = "firstloop_test+clerk_test@example.com";

export const TEST_EMAIL = process.env.E2E_CLERK_EMAIL ?? DEMO_EMAIL;

/** Matches http(s)://localhost and http(s)://127.0.0.1, with or without a port. */
const LOCAL_BASE_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

export function assertIdentityIsSafeFor(baseURL: string | undefined): void {
  const isLocal = baseURL === undefined || LOCAL_BASE_URL.test(baseURL);
  if (isLocal || process.env.E2E_CLERK_EMAIL !== undefined) return;

  throw new Error(
    `Refusing to run e2e against ${baseURL} as the demo account.\n\n` +
      `Every spec creates a plan, and the app shows the most recent one, so this ` +
      `run would leave that environment's demo dashboard showing a fresh plan with ` +
      `no history — the seeded persona would still exist, but nothing would surface it.\n\n` +
      `Set E2E_CLERK_EMAIL to a dedicated Clerk test user (any address containing ` +
      `"+clerk_test") and re-run. Reseed with:\n` +
      `  bun run --filter '@firstloop/db' db:seed`,
  );
}
