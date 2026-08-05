# Persona review — August 2026 (Checkpoint 18)

A step-back evaluation of the running app, from outside its own logic. Two personas — an experienced running-and-strength coach, and an app designer — used the product rather than reading the code, because reading the code inherits the assumptions the code was built on.

The previous review (Checkpoint 13) was recorded only in a session transcript. This one is a file, so the next round of work can read it.

## How it was run

Local dev stack, driven through the real UI in a browser. Authentication went through the project's own programmatic Clerk sign-in rather than typed credentials.

Three database states:

| State | Setup | Purpose |
|---|---|---|
| A | `db:seed` — 1 plan, 51 logs, week 9 of 38 | The normal case |
| B | Plans and logs deleted | Empty states and first-run routing |
| C | Plans generated through the intake form | Warnings, custom mode, injury path |

Every number below was read off the screen or measured against local Postgres. Nothing is estimated.

---

## Findings

| # | Finding | Severity | Tracked as |
|---|---|---|---|
| 1 | Coach compares total logged vs long-run-only planned mileage | Critical | [#41](https://github.com/lizorsini54/firstloop-marathon-app/issues/41) |
| 2 | Custom strength mode unexplained and prescribes nothing | High | [#43](https://github.com/lizorsini54/firstloop-marathon-app/issues/43) |
| 3 | ~~No per-exercise strength logging~~ — **wrong, see correction below**; the real gap is logging an exercise the plan didn't prescribe | High | [#42](https://github.com/lizorsini54/firstloop-marathon-app/issues/42) |
| 4 | Zero bike days renders blank | Medium | [#44](https://github.com/lizorsini54/firstloop-marathon-app/issues/44) |
| 5 | Post-generate, the prominent action regenerates | Medium | [#45](https://github.com/lizorsini54/firstloop-marathon-app/issues/45) |
| 6 | Current week plots as 0 while copy says "still open" | Medium | [#46](https://github.com/lizorsini54/firstloop-marathon-app/issues/46) |
| 7 | "Peak" means two things on one screen | Medium | [#47](https://github.com/lizorsini54/firstloop-marathon-app/issues/47) |
| 8 | Coach has no latency bound; its test can't enforce one | Medium | [#48](https://github.com/lizorsini54/firstloop-marathon-app/issues/48) |
| 9 | Plan-less user redirected with no explanation | Low | note only |
| 10 | Preview config breaks the API | Low | fixed here |

### 1. The coach tells an on-plan runner they are massively overshooting — CRITICAL

**State A, `/dashboard`.** The coach card said:

> For three straight weeks you ran nearly double the planned mileage (14-15mi against ~9mi planned) … You consistently ran 60-70% above planned mileage for three weeks.

This is false, and the runner is doing exactly what the plan asks. Measured against the database:

| Week starting | Runs logged | Logged, all runs | Planned, long run only |
|---|---|---|---|
| 2026-07-27 | 3 | 15.6 mi | 9.7 mi |
| 2026-07-20 | 3 | 14.8 mi | 9.4 mi |
| 2026-07-13 | 3 | 15.1 mi | 9.1 mi |

Three runs a week were planned; three were run. The "overshoot" is entirely an artefact of comparing two different quantities: **total logged mileage against long-run-only planned mileage.**

Cause, in `packages/contracts/src/lib/coach.ts:106-109`:

```ts
plannedMiles: round1(planned.filter(within).reduce((sum, p) => sum + (p.miles ?? 0), 0)),
actualMiles:  round1(logged.filter(within).reduce((sum, l) => sum + (l.miles ?? 0), 0)),
```

Easy and quality runs are prescribed by duration and carry no distance, so `p.miles ?? 0` contributes **0** to the planned side, while every logged run contributes its full distance to the actual side. The totals are then handed to the model as `planned Xmi, actual Ymi`, and it reports the discrepancy faithfully.

This is the **same defect Checkpoint 16 fixed in the dashboard chart** — the chart now restricts its logged series to logs whose linked planned workout actually prescribed a distance, and says so in its own caption directly beneath the coach card. The coach never received the equivalent fix.

Why nothing caught it: the e2e assertion for the coach is deliberately key-agnostic, checking only that the request settles, so it passes regardless of what the guidance says.

Harm is real rather than cosmetic — the advice is to stabilise a "volatile pattern" by cutting back, given to a runner who is on plan.

**Triage: file as a bug, fix next.**

### 2. Custom strength mode is unexplained, and produces nothing — HIGH

Three separate gaps that compound into one bad experience.

**It is not explained.** Selecting "Follow a program" renders a caption ("Glute Gladiator: Revamped — 4 sessions a week, dropping to 3 during your peak running mileage"). Selecting "Custom" renders **no caption at all** — only a "Lift days per week" dropdown. The user chooses between the two with information about one of them.

**What it produces is empty.** A plan generated with Custom / 2 lift days puts this on the dashboard:

```
Thursday   Lift   Lift session
Friday     Lift   Lift session
```

Against program mode's `Lower A: Glute + Hinge Strength · Peak block · 6 exercises`. Custom mode reserves two days and prescribes nothing.

**And you cannot fill it in yourself.** See finding 3. So a Custom user gets a day labelled "Lift session" with no content, and no way to record what they actually did beyond a duration and an RPE.

Checkpoint 13 deferred the missing caption as cosmetic. Used end to end, it is not cosmetic — it is the visible edge of a mode that does very little.

**Triage: file as an enhancement.** Needs a product decision, not just copy: either say plainly that Custom reserves days for training you program yourself, or give it real content.

### 3. Strength sessions cannot be logged with per-exercise detail — HIGH

`/log` with type **Lift** selected renders exactly the same fields as a run: date, type, distance (miles, optional), duration, RPE, notes. There is no set, rep, or weight entry anywhere.

Two things make this sharper than a plain missing feature:

- `SessionLog.setLog` already exists in the schema, commented as "per-exercise sets/reps/weight for structured strength logging."
- `/history` renders seeded lift sessions as **"10 exercises logged"**, "6 exercises logged". The app displays a level of detail that no user can produce, because only the seed script writes `setLog`.

Secondary: the form offers "Distance (miles)" for Lift and Rest, where it is meaningless.

**Triage: file as an enhancement.** This is the largest functional gap found.

> **Correction (Checkpoint 22): the finding above is wrong, and the claim that no user can produce that detail is false.**
>
> Structured per-exercise logging already exists. Arriving at the log form from a planned LIFT row that carries prescribed exercises gives exercise names, prescribed sets/reps, coaching notes, per-set reps and weight inputs, and an "Add set" control — submitted as `setLog`, accepted by `setLogEntrySchema`, rendered by History. Observed directly:
>
> ```
> Barbell Hip Thrust    4 x 4-6       SET 1  SET 2  SET 3  SET 4   + Add set
> Barbell RDL           3 x 4-6       SET 1  SET 2  SET 3          + Add set
> Dumbbell Bulgarian…   3 x 8-10/leg  …
> ```
>
> **How this review got it wrong:** it tested `/log` directly and selected "Lift" from the type dropdown — the freeform path, which has no linked prescription — and generalised from that single route without trying the "Log this" path. The review's own stated method is to use the product; it used one door of two.
>
> The real gap is narrower: **there is no way to log an exercise the plan didn't prescribe.** Structured mode is gated on `isStructuredLift`, so it is unavailable for Custom-mode sessions (`exercises: []` by design) and for freeform lift logs. Both confirmed by observation at Checkpoint 22 — 0 set rows in each.
>
> The secondary note about "Distance (miles)" showing for Lift and Rest still stands.
>
> Left in place rather than rewritten, per the Checkpoint 12 precedent: the finding is the record of what was believed. See `docs/specs/strength-logging.md`.

### 4. Zero bike days renders as a blank field — MEDIUM, bug

On `/intake`, selecting **0** bike days leaves the trigger empty. Measured across values:

```
selected 0 -> trigger displays: ""   <-- BLANK
selected 1 -> "1"    selected 2 -> "2"    selected 3 -> "3"
```

`SelectItem` renders the raw number `{n}` (`Intake.tsx:283-287`), and `0` produces no visible text. Other numeric selects escape it only because none of them offers a zero.

It matters more than it looks: **0 bike days is the seeded demo's own configuration**, and one of only two clean day-economy configurations Checkpoint 16 identified. The recommended setting is the one that displays as nothing.

**Triage: file as a bug.** Likely a one-line fix (`{String(n)}`), to be confirmed.

### 5. After generating a plan, the prominent action is to generate another — MEDIUM

When a plan generates with warnings, the app stays on the intake form and shows the warning inline. In the novice + knee case the screen ends with:

- a warning box: "Reduced peak long-run mileage by 20% due to reported injury: Knee." containing a small text link, **"Continue to dashboard"**
- below it, a full-width blue **"Generate plan"** button

The plan already exists. The most visually prominent control regenerates it; the actual next step is a text link nested inside a warning. A first-time user is most likely to press the blue button again.

**Triage: file as an enhancement.**

### 6. The current week reads as zero on the chart and as "still open" above it — MEDIUM

On the same dashboard screen, for the same week:

- the tile reads `— MI` and "Nothing logged yet — the week's still open"
- the planned-vs-logged chart plots the current week at **0**, which reads as a missed week

Checkpoint 16 deliberately made *future* weeks null so they would not read as thirty missed weeks. The current week still plots as a real zero while the copy beside it says the opposite.

**Triage: file as a bug.**

### 7. "Peak" means two different things on one screen — MEDIUM

The dashboard header reads **BASE PHASE** (running periodization) while four rows in the same week read **· Peak block ·** (Glute Gladiator's own block naming). Both are correct in their own taxonomy; together they invite the reading that the app contradicts itself.

**Triage: file as an enhancement** — probably a qualifier such as "strength block: Peak".

### 8. The coach has no latency bound, and its own test can't enforce one — MEDIUM

Found by the verification run at the end of this checkpoint, not by either persona.

`e2e/stretch-features.spec.ts` failed twice in a row, then passed in 11.4s on a third run with a raised timeout. The coach's response time varies from ~11s to over 30s. While the request is outstanding the card sits at "Reading your last two weeks…" (disabled) with "Thinking…" beneath it, and the server logs no error — it is pending, not failed.

Two distinct defects:

**The card has no client-side timeout.** Its own test comment states the requirement: "a coach outage must never leave the dashboard stuck loading." That holds for a *failing* upstream, which is caught and collapses to the safe state. It does not hold for a *slow* one — there is no bound after which the card gives up and tells the user.

**The test cannot enforce the tolerance it declares.** It asserts `toBeEnabled({ timeout: 60_000 })`, but no test timeout is configured, so Playwright's 30s default applies and the test dies at 30s. The `timeout: 60_000` in `e2e/playwright.config.ts:18` is inside the `webServer` block — it governs server startup, not tests. The intended 60s allowance has never been reachable.

**Neither is visible in CI**, because the CI e2e job writes an `.env` with no `ANTHROPIC_API_KEY` (`grep -c ANTHROPIC_API_KEY .github/workflows/ci.yml` → 0). The coach short-circuits to its "not configured" state instantly, so CI exercises the fast path only and the real-latency behaviour is never tested anywhere.

Not fixed here, per this checkpoint's scope. It does not block CI for the reason above.

**Triage: file as a bug.**

### 9. A user with no plan is redirected with no explanation — LOW

**State B.** `/dashboard` and `/plan` both redirect to `/intake`. The routing works exactly as Checkpoint 17 designed it and is better than a dead-end empty state. But the user clicks "Dashboard" and lands on "Goal" with nothing saying why.

**Triage: note only.** Worth one line of copy whenever the intake page is next touched.

### 10. The project's own preview config breaks the API — LOW, fixed here

`.claude/launch.json` ran `bun run dev` directly. The preview tooling injects `PORT=5173`, and the server prefers `PORT` over `SERVER_PORT`, so the API bound to 5173 alongside Vite and every authenticated page rendered "Error: Failed to fetch."

This is the exact collision `CLAUDE.md` documents, and the launch config did not guard against it. **Fixed in this checkpoint** (`env -u PORT`) because it blocked the review itself. Recorded because it silently produces an app that looks badly broken.

---

## Confirmed still open, not re-reported as new

Checkpoint 13 deferred these. Each was checked this pass rather than assumed:

- **No cutback week in base or build.** Measured: zero week-over-week long-run reductions in the first 14 weeks, for both a novice at 8 mi/week and an experienced runner at 40 mi/week.
- **Peak long-run distance is a fixed constant.** Measured: **19 mi for both** profiles above. For the 40 mi/week runner the entire 43-week plan moves the long run from 14 mi to 19 mi.
- **Strength progression steps only at block boundaries**, not week to week.
- **Interference and spacing rules are invisible in the UI.**

Open issues #9, #10, #13 and #15 remain accurate as written.

## What held up

Worth recording, since a review that only lists faults gives a false picture:

- Checkpoint 17's routing works — `/dashboard` and `/plan` both redirect correctly with no plan.
- Every empty state is real and well-worded. `/log` works standalone for a user with no plan, exactly as Checkpoint 16 claimed.
- The day-economy warning fires honestly and proportionally: "43 of 43 weeks get fewer sessions than planned" for 5 running + 2 bike days.
- The client-side feasibility check works as you type: "Only 15 weeks until race day — we recommend at least 20 for a first marathon (5 weeks short)."
- The injury path works end to end and states what it did: "Reduced peak long-run mileage by 20% due to reported injury: Knee."
- The mileage chart's caption is honest about what it measures, and the "not measured in miles" treatment renders correctly.
- The coach's *structure* is good — specific, quantified, non-prescriptive, with a separate "worth a look" callout. Finding 1 is about the numbers it is given, not how it reasons about them.
