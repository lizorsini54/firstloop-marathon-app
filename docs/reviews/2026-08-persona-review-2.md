# Persona review 2 — August 2026 (Checkpoint 24)

The second step-back evaluation. Same method as [the first](./2026-08-persona-review.md): two personas using the product in a browser rather than reading the code.

Run after Checkpoints 19–23, four of which changed real behaviour. Checkpoint 23 is why it ran now rather than later — it rebuilt the log form, which is the flow the previous review explored least well and drew a wrong conclusion about.

## The method fix this review applied

The last review's error was not carelessness, it was **generalising from one entry point**: it tested `/log` with the type dropdown, never tried the "Log this" path, and concluded per-exercise logging didn't exist.

So this review carried an explicit rule: *for any capability, enumerate every route that reaches it and exercise each.* The log form was tested from all three doors — a Glute Gladiator row, a Custom row, and freeform `/log`. The coach was checked in every state it can occupy rather than only the happy one.

That rule is what found finding 1, which is only reachable through one specific door.

## How it was run

Local stack, real UI, programmatic Clerk sign-in. Four database states — seeded persona, no-plan (rows cleared), a warning-triggering intake, and **a Custom-mode plan with logged sessions**, which did not exist as a reviewable state until Checkpoint 23.

Every number below was read off the screen or measured against local Postgres.

---

## Findings

| # | Finding | Severity | Tracked |
|---|---|---|---|
| 1 | Changing Type on a session opened from a plan row strands the link across types | **High** | [#56](https://github.com/lizorsini54/firstloop-marathon-app/issues/56) |
| 2 | "Remove" on a prescribed exercise doesn't say what it means | Medium | [#57](https://github.com/lizorsini54/firstloop-marathon-app/issues/57) |
| 3 | Duration is the only required field, isn't prefilled for lifts, and sits last | Medium | [#58](https://github.com/lizorsini54/firstloop-marathon-app/issues/58) |
| 4 | "1 exercises logged" | Low | [#59](https://github.com/lizorsini54/firstloop-marathon-app/issues/59) |
| 5 | The coach's `no_plan` state is unreachable | Low | [#60](https://github.com/lizorsini54/firstloop-marathon-app/issues/60) |
| 6 | An added exercise isn't labelled as yours | Low | note only |

### 1. Changing Type on a session opened from a plan row strands the link — HIGH

Open Thursday's **Lift** row via "Log this", change Type to **Run**, fill it in, submit. The log persists as a run, still linked to the planned lift:

```
 logged_type | distanceMiles | durationMin | planned_type |   day
-------------+---------------+-------------+--------------+----------
 RUN         |           3.1 |          31 | LIFT         | THURSDAY
```

A 3.1-mile run is now attached to a Glute Gladiator strength session. The consequence is in adherence, and it is worse than a wrong label:

- `buildTrainingSnapshot` builds `loggedPlanIds` from `plannedWorkoutId` with **no type check** (`coach.ts:138-140`), so the planned lift is filtered out of `missedSessions` (`coach.ts:145`) — the runner is not told they skipped it.
- `strengthCompleted` counts logs by `type === "LIFT"` (`coach.ts:151`), so the run does not count as strength work either.

The session vanishes from both sides: not missed, not completed.

**This is not new, but Checkpoint 23 widened it.** Before, arriving from a *run* row showed the Type field, so run→lift was already possible. Checkpoint 23 made Type visible on lift arrivals too — deliberately, and for a good reason — which doubled the ways in.

Found only because the rule above forced testing the same form from a door the previous review never opened.

**Triage: file as a bug.** The fix is a product decision (refuse the switch, drop the link, or warn), so it needs its own checkpoint rather than a patch here.

### 2. "Remove" on a prescribed exercise doesn't say what it means — MEDIUM

Every exercise card carries a **Remove** control, prescribed or added. On a prescribed exercise it is genuinely ambiguous: does it mean *"I skipped this"* or *"hide this row"*?

The spec settled the behaviour — removal does not affect adherence, the session still counts as completed via `plannedWorkoutId` — but nothing on screen says so. A coach persona's instinct is that skipping a prescribed lift is information worth keeping, and a runner may reasonably believe Remove records it.

Related: there is no way to record *"I did this session but skipped the Bulgarian split squats."* Removing the row and logging the rest is the closest available, and it silently discards the fact.

**Triage: file as an enhancement.** Copy is the cheap half; whether skipping should be recordable is a real product question.

### 3. Duration is the only required field, isn't prefilled for lifts, and sits last — MEDIUM

A Glute Gladiator session opens with six exercises and roughly twenty optional reps/lbs inputs. Below all of them sit Duration, RPE, Notes. **Duration is the only required field on the form** (`durationMin: z.number().int().positive()`), it is empty for a lift because the plan prescribes lifts by content rather than time, and it is the last thing a runner filling top-to-bottom reaches.

Runs get their duration prefilled from the prescription (Checkpoint 17). Lifts cannot, because there is no planned duration to use.

**Triage: file as an enhancement.** Options range from moving the field, to defaulting it, to asking whether a lift should require a duration at all.

### 4. "1 exercises logged" — LOW

`/history` after logging a Custom session with one exercise. The string is unconditionally pluralised.

**Newly reachable because of Checkpoint 23.** Only the seed wrote `setLog` before, and seeded lifts carry six to eleven exercises, so the singular case could not occur. Making user logging possible made a latent copy bug visible.

**Triage: file as a bug.**

### 5. The coach's `no_plan` state is unreachable — LOW

`getCoachFeedbackOutputSchema` includes `no_plan`, and `CoachCard` renders copy for it ("There's no plan to review yet — set your goal first"). Neither can happen: `CoachCard` only appears on the dashboard, and since Checkpoint 17 the dashboard redirects to `/intake` whenever `plan` is null. Confirmed in the no-plan state — the card never rendered.

Harmless, but it is contract surface and UI copy that document a state the app cannot reach.

**Triage: file as a bug** (dead state), low priority.

### 6. An added exercise isn't labelled as yours — LOW

A user-added exercise is distinguishable from a prescribed one — editable name input, no sets/reps hint, no coaching note — but nothing names the difference. On a mixed session it is inferable rather than stated.

**Triage: note only.** Worth one word of labelling if #57 is picked up, since both are about the same card.

---

## Previous findings, re-checked in situ

**#46 — current week plots as 0 while the tile says "still open": still valid.** Unchanged by Checkpoints 19–23.

**#47 — "Peak" means two things: still valid, and confirmed on screen.** The seeded dashboard reads `WEEK 9 OF 38` / `BASE PHASE` in the header while four rows in the same week read `· Peak block ·`.

**#45 — post-generate navigation: still valid.** Unchanged.

## Checkpoint 13/18 deferrals, re-verified by measurement

Not re-reported as findings. Confirmed still open by calling `generatePlan` directly:

- **No cutback week in base or build** — zero week-over-week long-run reductions in the first 14 weeks, for both a novice at 8 mi/week and an experienced runner at 40 mi/week.
- **Peak long-run distance is a fixed constant** — **19 mi for both** profiles.
- Block-level strength progression and invisible interference rules: unchanged.

Open issues #9, #10, #13, #15 remain accurate as written.

## What held up

- **The rebuilt log form works from all three doors.** Prescribed exercises prefill with names, sets/reps and notes; a Custom session shows "Nothing prescribed for this session — add whatever you lifted"; freeform lifts offer the same. Add, rename, remove and add-set all behave.
- **Custom mode now delivers what its caption promises.** Generated a Custom plan, logged a session with a user-added exercise, and it appeared in History — the loop the caption describes is real.
- **Checkpoint 20's `timed_out` copy reads well** in situ: "The coach took too long to answer and the request was given up on. Nothing's broken — asking again usually works." Distinct from the `failed` copy, and it tells the runner the useful thing.
- **Checkpoint 19's fix holds.** The coach compares long-run distance to long-run distance and makes no overshoot claim.
- **Checkpoint 21's fix holds.** Numeric selects render every value including zero.
- **Checkpoint 17's routing holds.** `/dashboard` and `/plan` both redirect to `/intake` with no plan; every empty state renders.
