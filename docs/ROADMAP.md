# Checkpoint roadmap

Ordered plan for the work coming out of the [August 2026 persona review](./reviews/2026-08-persona-review.md). Checkpoint 19 is done; everything below is sequenced but not started.

This is a plan, not a contract. The order reflects dependencies and blast radius, and it is expected to be re-judged when a checkpoint finishes — the review that produced it exists precisely because plans stop matching reality.

## Ground rules these checkpoints run under

- One feature per checkpoint, its own branch, its own PR into `main`.
- Plan mode before any code, every time.
- Anything landing in `plan-engine`, `strength-engine` or `scheduling` gets a short plain-language spec — rules, inputs, outputs — **before** the plan. Small UI-only fixes are exempt.
- `bun run check` plus relevant suites before every commit. Never commit red.
- Every real decision logged to `DECISIONS.md` as it is made.
- Diagnose before fixing; verify against the running app, not against what the docs say about it.

## Done

| CP | Work | Outcome |
|---|---|---|
| 18 | Step-back persona review | 10 findings, 7 issues filed (#41–#48) |
| 19 | Coach long-run mileage comparison (#41) | Merged in [#50](https://github.com/lizorsini54/firstloop-marathon-app/pull/50). Coach no longer reports an on-plan runner as 60–70% over |

## Next

### CP20 — Coach latency bound and a test that can enforce it (#48)

**Why now:** it unflakes the local e2e suite, which every later checkpoint's verification depends on. Currently `stretch-features` fails intermittently on any machine with a real API key.

Two defects, one checkpoint because they are the same fault seen from both sides:

- The card has no client-side timeout. A *failing* upstream is handled correctly and collapses to the safe state; a *slow* one leaves it stuck at "Thinking…" indefinitely.
- The test asserts `toBeEnabled({ timeout: 60_000 })`, but no test timeout is configured, so Playwright's 30s default applies and the assertion dies at 30s. The `timeout: 60_000` in `e2e/playwright.config.ts` is the `webServer` startup timeout, not a test timeout.

**Decision this checkpoint must make, not defer:** whether CI should exercise the coach with a real key at all. Today CI writes an `.env` with no `ANTHROPIC_API_KEY`, so the coach short-circuits instantly and its real-latency path is tested nowhere. That is why CI has been green while local is red.

No spec required — `contracts` and `e2e`, not the engines.

### CP21 — Zero renders blank (#44)

A one-line-ish fix with a real consequence: `SelectItem` renders the raw number `{n}`, so `0` produces an empty trigger, and **0 bike days is the seeded demo's own configuration** and one of only two clean day-economy setups. The recommended setting is the one that displays as nothing.

Include a sweep for any other select that can receive a falsy value. Small, still its own PR.

### CP22 — The strength story: decide, don't build (#42, #43)

**Spec only. No implementation.** This is the one checkpoint deliberately spent not coding.

#42 and #43 are coupled: Custom mode is unusable partly *because* per-exercise logging does not exist. Today Custom gives you a bare `Lift session` row with no prescription, no caption explaining what you chose, and no way to record what you actually lifted. Meanwhile `/history` renders seeded lifts as "10 exercises logged" — the app displays detail no user can produce, because only the seed script writes `SessionLog.setLog`.

Questions that need answering before any code:

1. Does **Custom** mean "we reserve days, you program them" — honest, cheap, largely copy — or "we generate a real minimal program", which is a genuine `strength-engine` feature?
2. Does **per-exercise logging** land, and does it write to the existing `setLog` field?
3. If logging lands, does the seeded "N exercises logged" display stay as-is, or change to match what a user can actually produce?

Touches `strength-engine` under option (1b), so the spec-before-code rule applies. Implementation follows as CP23–24, scoped by what is decided here.

### CP23–24 — Implement the strength decision

Scope depends entirely on CP22. Likely two checkpoints: the logging surface first, then Custom-mode content, since the second is more defensible once the first exists.

### CP25 — Display honesty pass (#46, #47)

Both are cases of the app saying two things about one fact on a single screen:

- The current week plots as `0` on the chart while the tile above reads "the week's still open." Checkpoint 16 made *future* weeks null for exactly this reason; the in-progress week was missed.
- "Peak" names both a running phase and a Glute Gladiator strength block, with no signal that these are separate vocabularies.

Grouped because they are one theme and each is small. If they turn out to be more than a session's work, split them.

### CP26 — Post-generate navigation (#45)

After generating with warnings the app stays on the intake form, and the most prominent control is a full-width blue "Generate plan" button while the actual next step is a text link nested inside a warning box. Also worth separating the two jobs that box is doing: reporting a warning, and offering navigation.

### CP27 — Cutback weeks and peak long-run scaling

**Spec first — `plan-engine`.** The two engine-level deferrals from Checkpoint 13, re-verified as still open during the review:

- Zero week-over-week long-run reductions in the first 14 weeks, for both a novice at 8 mi/week and an experienced runner at 40 mi/week.
- Peak long-run distance is **19 mi for both profiles**. For the 40 mi/week runner the entire 43-week plan moves the long run from 14 mi to 19 mi.

Overlaps #9 ("refine periodization heuristics"), which should be closed or explicitly re-scoped when this lands rather than left as a permanent open ticket.

## Before the schema-touching work

**#10** (edit/delete) and **#15** (multi-plan selection) both need migrations. Migrations currently run at server *start* against the only database that exists, and CI only ever proves a migration applies to an **empty** database — the e2e job runs `db:deploy` against a fresh Postgres.

Nothing proves a migration applies cleanly to a database that already holds rows. Close that before attempting either issue: rehearse the migration against a restored production dump. That costs nothing and does not require a second environment.

The separate question — whether to pay for a Railway pre-prod environment now that this is ongoing work rather than a bounded submission — is worth its own evaluation, but the thing it uniquely buys is a shareable staging URL for someone else to test against. That need does not exist yet.

## Standing items

- **Next step-back review:** after roughly four checkpoints, or as soon as the strength area lands — whichever comes first. Cross-cutting changes are exactly what the per-checkpoint tests do not catch.
- **Backlog hygiene:** the review added 8 issues to a list of 4. That is healthy for one pass, but if successive checkpoints keep adding without closing, the log stops being a plan. #9 is the first candidate for closing or re-scoping.
- **Not tracked as an issue, noted in the review:** a user with no plan is redirected from `/dashboard` to `/intake` with no explanation. Worth one line of copy whenever the intake page is next touched.
- **Manual, outside the code:** create the dedicated Clerk test user (`firstloop_e2e+clerk_test@example.com`) so e2e can run against a deployed environment without burying the seeded demo. Until it exists, `E2E_CLERK_EMAIL` is unset and non-local runs refuse outright, which is the safe failure.
