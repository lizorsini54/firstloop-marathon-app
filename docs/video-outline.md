# Cadenza — walkthrough script

Target **5–8 minutes**. The script below is **~1,270 spoken words**: about **7:30 at a brisk pace, 8:30 if you take your time.** Pace is the main lever — at a normal technical delivery of roughly 160 words a minute it lands just under 8:00. One further *optional cut* remains marked in section 7 (worth ~15 seconds) if you'd rather have the margin. Every factual claim here is checkable against [WRITEUP.md](./WRITEUP.md) and [DECISIONS.md](../DECISIONS.md).

**The through-line:** stated in section 0, closed in section 8 — *everything here is checkable, and the places where the system proved me wrong are in the record.* Sections 5, 7 and 8 are the evidence. Without that spine this is a competent tour; with it, it's an argument.

## How to read this

- **Everything in a `>` blockquote is spoken aloud, and nothing else is.** If it isn't quoted, don't say it.
- **On screen / Do** — what to show and what to click.
- **Note —** direction for you, never spoken.

## Recording notes

- **Record in sections and cut.** Nothing here is a live demo, so there's no reason to take it in one pass.
- **Section 4 runs `bun run check` for real** — start it, then cut the wait in the edit. Showing it actually run is worth more than a screenshot, and section 7 depends on the audience believing it.
- **Set up before you roll:** demo account seeded and signed in; a second browser profile or window for the section 5 plan so you're not deleting the demo; a merged PR open in a tab for the CI shot.
- **Script is written to be spoken.** Read it out loud once before recording — anything that trips you is a line to rewrite, not to power through.

---

## 0. Open — 0:30

**On screen:** the dashboard, static. Don't interact yet.

**Say:**

> This is Cadenza — a marathon training app for a first-time marathoner who's also a serious lifter and rides most weeks.
>
> The brief asked for an authenticated app where you can record a session, and said it needn't be feature-complete. I built past that deliberately.
>
> But the part worth your time isn't the feature list. It's the number of times this system caught something I'd got wrong — and the fact that all of it is written down.

---

## 1. The shape of it — 0:50

**On screen:** the README's two Mermaid diagrams. Don't open the app.

**Say:**

> Before the app, the architecture. One request.
>
> The browser calls an oRPC client that attaches a Clerk bearer token. Express hands it to Clerk's middleware, then to a protected procedure that throws Unauthorized before any handler runs. Zod validates the input, the handler reaches Postgres through Prisma, and Zod validates what comes back.
>
> Frontend and backend share one contract — the web app imports the router's *type*, never its implementation.
>
> And these three packages hanging off the handler touch no database and no network at all. That matters later.

**Do:** switch to the deployment diagram.

> Three Railway services from one repo, deploying from main. One environment — I built the full dev, pre-prod and prod split, then reverted it when it turned out to need a paid plan. That's in the decisions log as a cost tradeoff, not an omission.

---

## 2. The design — 0:45

**On screen:** the dashboard. Zoom on the numbers, then the phase arc.

**Say:**

> A quick word on the look, because it's deliberate. The register I wanted was instrument panel — a GPS watch face, not a wellness app.
>
> Three typefaces doing three jobs: a condensed display face for headings, a humanist sans for prose, and a mono for every number. Mileage, pace, duration, RPE, dates — all tabular, all visually separate from words. For someone who reads a watch face every day, that was the highest-leverage call in the design.
>
> And this arc is the signature element. It's computed from the real plan, so those base, build, peak and taper proportions are *this* plan's, not a decorative shape.

---

## 3. Using it — 1:15

Move briskly. This is the least distinctive part of the video and it's setting up sections 5 and 7.

**On screen:** intake → generate → Schedule → dashboard.

**Say:**

> Now the product. A race date and my current weekly mileage.
>
> This feasibility check runs in the browser as I type, because the plan engine is a pure package the web app imports directly — and the server runs the same function again when the plan is created. It tells you if your runway is short, and it never blocks you. That's a coaching judgment call, and I've labelled it as one rather than dressing it up as science.

**Do:** generate, then open Schedule.

> Thirty-nine weeks. Tabs by phase, weeks inside them. And the strength sessions are placed *around* the running, not beside it — the scheduler knows which days are hard.

**Do:** back to the dashboard. Click **"Log this" on a run row** — not the generic button.

> I'll log Monday's run from the row itself. Type and duration arrive prefilled, because the plan already said what it wanted.
>
> Distance is blank on purpose. That run is prescribed by time, not distance, and the app won't invent a number it doesn't have.
>
> Remember this click.

**Note —** the AI Coach beat that used to sit here has been cut, to bring the runtime back inside eight minutes. Section 7 explains what the coach does at the point where it actually matters, so nothing is lost. Don't click "Ask the coach" on camera in this section.

---

## 4. What's supposed to catch things — 0:40

This is two shots: a terminal, then a browser. Set both up before you roll.

### Before recording

1. **Terminal** — open at the repo root, window large enough that the whole `check` output fits without scrolling. Clear it (`Cmd+K`) so the command is the first thing on screen.
2. **Browser tab** — open this exact page, which is the CI run for the last merged PR:
   **https://github.com/lizorsini54/firstloop-marathon-app/actions/runs/30833595282**
   It shows a left sidebar headed **All jobs** listing `check`, `integration` and `e2e`, each with a green tick, plus **Status: Success** and **Total duration: 1m 39s** in the panel on the right. Everything you need is in one frame — nothing to expand or click.
   *For a different run later: repo → **Actions** tab → click the top run in the list.*

### Shot 1 — the terminal

**Do:** type and run:

```
bun run check
```

**Do:** let it actually run, then **cut the wait in the edit** — it takes 30–60 seconds. Cut from the moment you press Enter to the final `77 pass / 0 fail`.

**Say** (over the command starting, and the result landing):

> Before I show you what this got wrong, here's what's meant to catch it.
>
> One command locally — TypeScript, ESLint, Knip for dead code, and the unit tests. That's the pre-commit gate.

### Shot 2 — CI

**Do:** cut to the browser tab. Point at the three job names in the left sidebar as you name them.

**Say:**

> And in CI, three required checks on every pull request. That same command, an integration suite against a real Postgres in a container, and Playwright against the whole stack. All three have to pass to merge.
>
> Every checkpoint in this project went in through that. Ninety-one tests, all green.

### Notes to yourself — not spoken

**Don't oversell this.** Two sections from now is about what it all missed, and that only works if you were straight here. Resist adding "and it's all thoroughly tested" — section 7 is about to prove it wasn't.

**Counts, as of this recording:** 77 unit (`bun run test`), 10 integration (`bun run test:integration`, Testcontainers), 4 Playwright (`bun run test:e2e`) — **91 total**. Section 7 quotes these back, so if you touch anything before recording, re-run all three and re-count.

**Why the split is worth one sentence if you have room:** Testcontainers needs Docker and Playwright needs the whole stack running, so neither belongs in the fast local loop — but both are still required before anything merges.

---

## 5. A warning, fired on purpose — 1:00

**On screen:** intake with **4 running days / 1 bike day / "Follow a program"**, then the warning.

**Say:**

> Here's a plan built to fail. Four running days, a bike day, and the full strength program.

**Do:** generate. Let the warning render.

> There it is. It's telling me the schedule can't fit what it promised. Thirty-nine weeks out of thirty-nine come up short on sessions, and two lower-body days land back to back in thirty-three of them.
>
> Two things. It reports proportionally, and there's no threshold — a single bad week still gets named. And it exists because the old behaviour was to silently drop the session instead.

**Beat. Slow down here.**

> Now — that configuration was this app's own default. My plan was to nudge the day counts until it stopped complaining.
>
> So I swept the whole configuration space through the check itself. Only one combination keeps the full program at all. The program needs four free days a week, and every run or ride takes one away.
>
> The check was right and I was wrong. I moved the defaults. I never touched the check.

---

## 6. One architecture claim, tested by accident — 1:15

**On screen:** the three pure packages, or the program data file next to the scheduler.

**Say:**

> One architecture claim, and how it got tested without me arranging it.
>
> The strength program is data. The scheduler is generic code reading constraints out of that data. Claims like that are easy to make and hard to prove.
>
> Then I needed a custom mode — no named program, just a number of days a week. And that surfaced a boolean quietly doing two jobs: keep this session off the day before a hard run, *and* keep paired sessions apart. Different rules. They only looked like one because this particular program needs both, on the same sessions. So I split them.
>
> Then running needed the same day-placement logic for its own fix. Rather than write it a third time I pulled it into its own package, and both engines depend on it now.
>
> The architecture held up under reuse I hadn't planned for. That's a real test. Holding up in the paragraph describing it isn't.

---

## 7. What all of that still missed — 1:15

**On screen:** the dashboard's current week. Point at a run row.

**Say:**

> Everything I just showed you was green. Here's what got past it.
>
> Remember that click — logging a run from the dashboard. That button did not exist for runs until the final checkpoint of this project. It had been there for strength sessions only, since the day I added the strength program.

**Three beats. Each one makes the next worse.**

> Nothing caught it. Types fine, ninety tests passing, and it survived a review where I had two personas actually use the product rather than read the code.

**Then the payoff — say this immediately after, don't leave it implied:**

> There's a ninety-first test now. It clicks that button on a run row and fails if it ever goes missing again. I checked it fails by putting the bug back, and while it failed, the original golden-path test still passed — which is exactly why nothing caught this the first time.
>
> Second — my own decision log said the opposite. An earlier checkpoint justified leaving another view read-only *because the dashboard already had this action*. It didn't, for runs. Documentation asserting something false is worse than none, and the log now says that, next to the original decision, which still stands.
>
> Third, the real cost. The coach works out what you missed by checking that link back to the plan. Someone logging every run faithfully, through the only route they had, would have been told they'd missed all of them. And the seed data sets that link directly — which is precisely why eight weeks of demo data never showed it.

**Beat.**

> It took a person clicking the thing. No test was going to find it, because the fixture that made the tests realistic was the same fixture hiding the bug.

**Fast, as evidence it wasn't a one-off.** *(First optional cut if you're running long — the section still lands without it.)*

> Two others. A strength session silently vanishing from weeks thirty-one to thirty-six, visible only by reading a full plan end to end. And four hundred and fifty orphaned session logs — the coach reporting eighty-mile weeks on a plan whose longest run is under ten.

---

## 8. Close — 0:30

**On screen:** back to the dashboard, or `DECISIONS.md`.

**Say:**

> What's not here. No cutback weeks in base and build. The peak long run is a fixed number rather than scaled to the runner. Strength progresses by block, not week to week. And the scheduler's spacing rules are correct but invisible in the interface.
>
> All named. None of them left for you to find.
>
> And that's the point. Three times in this video the system told me I was wrong — and every one of those is in the decisions log, written when it happened rather than reconstructed for the recording.
>
> Thanks for watching.
