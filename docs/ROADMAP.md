# Checkpoint roadmap

Ordered plan for the work coming out of the two August 2026 persona reviews — [the first](./reviews/2026-08-persona-review.md) and [the second](./reviews/2026-08-persona-review-2.md). Checkpoints 19–24 are done; everything below them is sequenced but not started.

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
| 19 | Coach long-run mileage comparison (#41) | Coach no longer reports an on-plan runner as 60–70% over |
| 20 | Coach latency bound and a real test timeout (#48) | Request settles within 25s; local e2e trustworthy again |
| 21 | Numeric selects render zero (#44) | Fixed as a pattern across all three, not just the broken one |
| 22 | Corrected the strength-logging finding, wrote the spec | #42's original framing was false; the real gap specified |
| 23 | Log exercises the plan didn't prescribe (#42, #43) | One form, three entry points; Custom mode delivers its caption |
| 24 | Second step-back persona review | 6 findings, 5 issues (#56–#60) |

## Next

### CP25 — Type-switching strands the plan link (#56)

**Promoted above the display pass.** It is the only open finding that corrupts data rather than confusing a reader: a run logged against a planned lift is neither missed nor completed, so it disappears from adherence entirely.

The fix is a product decision — refuse the switch when the log came from a plan row, drop `plannedWorkoutId` when the type stops matching, or warn and proceed — so it wants its own checkpoint rather than a patch.

### CP26 — Display honesty pass (#46, #47)

Both are cases of the app saying two things about one fact on a single screen:

- The current week plots as `0` on the chart while the tile above reads "the week's still open." Checkpoint 16 made *future* weeks null for exactly this reason; the in-progress week was missed.
- "Peak" names both a running phase and a Glute Gladiator strength block, with no signal that these are separate vocabularies.

Grouped because they are one theme and each is small. If they turn out to be more than a session's work, split them.

### CP27 — Post-generate navigation (#45)

After generating with warnings the app stays on the intake form, and the most prominent control is a full-width blue "Generate plan" button while the actual next step is a text link nested inside a warning box. Also worth separating the two jobs that box is doing: reporting a warning, and offering navigation.

### CP28 — Cutback weeks and peak long-run scaling

**Spec first — `plan-engine`.** The two engine-level deferrals from Checkpoint 13, re-verified as still open during the review:

- Zero week-over-week long-run reductions in the first 14 weeks, for both a novice at 8 mi/week and an experienced runner at 40 mi/week.
- Peak long-run distance is **19 mi for both profiles**. For the 40 mi/week runner the entire 43-week plan moves the long run from 14 mi to 19 mi.

Overlaps #9 ("refine periodization heuristics"), which should be closed or explicitly re-scoped when this lands rather than left as a permanent open ticket.

## Before the schema-touching work

**#10** (edit/delete) and **#15** (multi-plan selection) both need migrations. Migrations currently run at server *start* against the only database that exists, and CI only ever proves a migration applies to an **empty** database — the e2e job runs `db:deploy` against a fresh Postgres.

Nothing proves a migration applies cleanly to a database that already holds rows. Close that before attempting either issue: rehearse the migration against a restored production dump. That costs nothing and does not require a second environment.

The separate question — whether to pay for a Railway pre-prod environment now that this is ongoing work rather than a bounded submission — is worth its own evaluation, but the thing it uniquely buys is a shareable staging URL for someone else to test against. That need does not exist yet.

## Standing items

- **Next step-back review:** last run at Checkpoint 24. Due again after roughly four more checkpoints, or sooner if a flow gets substantially rebuilt — Checkpoint 23 rebuilding the log form is exactly the trigger that pulled the last one forward.
- **Backlog hygiene:** the review added 8 issues to a list of 4. That is healthy for one pass, but if successive checkpoints keep adding without closing, the log stops being a plan. #9 is the first candidate for closing or re-scoping.
- **Not tracked as an issue, noted in the review:** a user with no plan is redirected from `/dashboard` to `/intake` with no explanation. Worth one line of copy whenever the intake page is next touched.
- **Manual, outside the code:** create the dedicated Clerk test user (`firstloop_e2e+clerk_test@example.com`) so e2e can run against a deployed environment without burying the seeded demo. Until it exists, `E2E_CLERK_EMAIL` is unset and non-local runs refuse outright, which is the safe failure.
