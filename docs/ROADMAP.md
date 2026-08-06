# Checkpoint roadmap

Ordered plan for the work coming out of the two August 2026 persona reviews — [the first](./reviews/2026-08-persona-review.md) and [the second](./reviews/2026-08-persona-review-2.md). Checkpoints 18–28 are done; everything below them is sequenced but not started.

This is a plan, not a contract. The order reflects dependencies and blast radius, and it is expected to be re-judged when a checkpoint finishes — the reviews that produced it exist precisely because plans stop matching reality. This file was itself two checkpoints out of date before this refresh, which is the failure mode it should be checked against.

## Ground rules these checkpoints run under

- One feature per checkpoint, its own branch, its own PR into `main`.
- Plan mode before any code, every time.
- Anything landing in `plan-engine`, `strength-engine` or `scheduling` gets a short plain-language spec — rules, inputs, outputs — **before** the plan. Small UI-only fixes are exempt.
- `bun run check` plus relevant suites before every commit. Never commit red.
- Every real decision logged to `DECISIONS.md` as it is made.
- Diagnose before fixing; verify against the running app, not against what the docs say about it.
- A guard that has never been seen to fail is not yet a guard — reintroduce the bug and watch the new test catch it.
- **This file is updated in the same PR as the checkpoint it describes** — not as a follow-up someone remembers. It went two checkpoints stale once; the fix is that updating it stops being a separate act.

## Done

| CP | Work | Outcome |
|---|---|---|
| 18 | Step-back persona review | 10 findings, 7 issues (#41–#48) |
| 19 | Coach long-run mileage comparison (#41) | No longer reports an on-plan runner as 60–70% over |
| 20 | Coach latency bound and a real test timeout (#48) | Settles within 25s; local e2e trustworthy again |
| 21 | Numeric selects render zero (#44) | Fixed as a pattern across all three, not just the broken one |
| 22 | Corrected the strength-logging finding, wrote the spec | #42's original framing was false; the real gap specified |
| 23 | Log exercises the plan didn't prescribe (#42, #43) | One form, three entry points; Custom mode delivers its caption |
| 24 | Second step-back persona review | 6 findings, 5 issues (#56–#60) |
| 25 | A log can't claim a planned workout it doesn't match (#56) | Validated server-side; shared by every write path |
| 26 | `migration-over-data` CI job + `db:rehearse` | A migration that breaks on real rows now fails the build |
| 27 | Edit and delete a logged session (#10, session half) | Plan half split out as #64 |
| 28 | Quick-win pass (#59, #60, #46, #47) | Four one-screen contradictions closed; #60 turned out not to be dead code |

Test coverage across those: 77 → 83 unit, 10 → 19 integration, 4 → 11 e2e, plus a fourth required CI check.

## Next

### CP29 — A docs-freshness guard

The roadmap went two checkpoints stale and nobody noticed until it was read closely. A ritual won't fix that — Checkpoint 18's lesson is that discipline dependencies fail — so this is a `bun run docs:check` script plus a CI job.

What it can catch, all structural:

- a checkpoint listed under **Next** that already has a `## Checkpoint N` entry in `DECISIONS.md`, i.e. it shipped and this file didn't notice
- an issue referenced as upcoming that is actually **closed**
- a relative link in `docs/` pointing at a file that doesn't exist

**What it cannot catch, stated plainly:** a claim that quietly became false. `DECISIONS.md` asserting dashboard logging worked for every session type, or the first review's finding #42, are both invisible to any mechanical check. Those remain the job of the persona reviews and of verifying against the running app — this guard is not a substitute for either.

### CP30 — Post-generate navigation (#45)

After generating with warnings the app stays on the intake form, and the most prominent control is a full-width blue "Generate plan" button while the actual next step is a text link nested inside a warning box. Also worth separating the two jobs that box does: reporting a warning, and offering navigation.

Its own checkpoint rather than part of CP28 because it changes a flow rather than a string, and the warning box wants redesigning rather than tweaking.

### CP31 — Plan management (#15, #64) — the big one

**Do these together.** Whatever surface lets you choose among plans is where you'd archive or delete one; building them apart risks two plan-management screens.

- **#15** multi-plan selection. Today it's most-recent-wins with no UI. Likely needs a column, which makes this **the first real exercise of CP26's migration guard**.
- **#64** delete or archive a plan. Needs a decision first: `SessionLog.plannedWorkoutId` is `onDelete: SetNull` by CP14's deliberate choice, so deleting a plan silently unlinks its history and makes that period's adherence unrecoverable. Defensible, but it should be chosen rather than inherited. Archive may beat delete for a completed training block, where hard delete was right for a mistyped log.

**#10 closes when #64 does.**

Expect a spec-shaped checkpoint before implementation, as CP22 was for strength logging.

### CP32 — Log-form follow-ups (#57, #58)

Both touch the exercise card CP23 built, and both are better judged once CP31 has settled the surrounding surfaces.

- **#57** — "Remove" on a prescribed exercise doesn't say what it means, and there's no way to record *"I did the session but skipped the split squats."* Copy is the cheap half; whether skipping should be recordable is a real product question. Folds in the note-only finding that an added exercise isn't labelled as yours.
- **#58** — Duration is the only required field, isn't prefilled for lifts (the plan prescribes them by content, not time), and sits below roughly twenty optional inputs.

### CP33 — Cutback weeks and peak long-run scaling

**Spec first — `plan-engine`.** The two engine-level deferrals from Checkpoint 13, re-verified as still open at Checkpoint 24 by calling `generatePlan` directly:

- Zero week-over-week long-run reductions in the first 14 weeks, for both a novice at 8 mi/week and an experienced runner at 40 mi/week.
- Peak long-run distance is **19 mi for both profiles**. For the 40 mi/week runner the entire 43-week plan moves the long run from 14 mi to 19 mi.

**#9** ("refine plan-engine periodization heuristics") was these two in concrete form and is now **closed** — so this checkpoint carries the work on its own rather than against a ticket.

## Resolved: the schema-safety question

Checkpoint 26 closed this. `migration-over-data` proves on every pull request that a migration applies to a database already holding rows — demonstrated with a `NOT NULL` column that passes on an empty database and fails with `23502` on a populated one. `db:rehearse` covers the question a synthetic fixture can't: whether a migration survives *real* data, by dumping a source database and migrating the copy.

That also settles the Railway pre-prod question **for now**. The specific thing a second environment would have bought is covered. What remains is a shareable staging URL for someone else to test against — not a need that exists yet. Revisit if it appears.

## Standing items

- **Next step-back review:** last run at Checkpoint 24. Due again after roughly four more checkpoints — so around CP31's plan-management work, or sooner if a flow gets substantially rebuilt. CP23 rebuilding the log form is exactly the trigger that pulled the last one forward.
- **Backlog hygiene:** two reviews added 13 issues; **10 have closed** once CP28 lands (#41–#44, #46–#48, #56, #59, #60). #9 is closed too, separately. **#13** (loading skeletons, minimal form error handling) is the oldest untouched issue and has never been prioritised in any checkpoint — it deserves a deliberate keep-or-close decision rather than indefinite drift.
- **Not tracked as an issue, noted in the first review:** a user with no plan is redirected from `/dashboard` to `/intake` with no explanation. Worth one line of copy whenever the intake page is next touched.
- **Making `migration-over-data` required:** done. It is now one of four required checks, added after its first green run.
- **The dedicated Clerk e2e user** (`firstloop_e2e+clerk_test@example.com`) exists and is verified working. Set `E2E_CLERK_EMAIL` to it when running e2e against a deployed environment; without it, non-local runs refuse outright rather than burying the seeded demo.
