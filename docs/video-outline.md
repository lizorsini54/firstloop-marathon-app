# Cadenza — walkthrough video outline

Target length **5–8 minutes**; this runs to roughly **7:20**, leaving headroom. Structure follows [WRITEUP.md](./WRITEUP.md), so anything said here can be checked against that document and against [DECISIONS.md](../DECISIONS.md).

> **Ready to record.** Checkpoints 16 and 17 have landed. The seeded demo runs 3 running days / 0 bike / Glute Gladiator; the intake form defaults to 3 running days / 1 bike / custom-2; both are verified to produce no day-economy warning. Section 5 needs a plan built deliberately to trip it — the config is given there.

**The through-line.** State it in section 0 and pay it off in section 8: *everything here is checkable, and the places where the system proved me wrong are in the record.* Three sections are evidence for that one claim — the check that overruled the plan (5), the bug that got past every test (7), and the limitations named rather than discovered later (8). Without the thesis this is a competent tour. With it, it's an argument.

---

## 0. Open — 30s

Name the persona in one sentence: a first-time marathoner who is also a seasoned lifter and an active cyclist. Say what the brief asked for — authenticated UI plus the ability to record a session, explicitly not feature-complete — and that everything past that was a deliberate choice, revisited more than once.

Then state the thesis, plainly, before anything is on screen: the interesting part of this project isn't the feature list, it's the number of times the system caught something I'd got wrong, and that all of it is written down.

## 1. The diagram first — ~50s

Screen share the README's two Mermaid diagrams. Do not open the app yet.

**Request flow.** Trace one call end to end: browser → oRPC client with a Clerk bearer token → Express → `clerkMiddleware` → `protectedProcedure` throwing `UNAUTHORIZED` before any handler runs → Zod input validation → handler → Prisma → Postgres → Zod output validation → typed response. The point to land: frontend and backend share *one* contract, and the web app imports the router's type only.

Call out the pure packages hanging off the handler — `plan-engine`, `strength-engine`, both onto `scheduling` — with no database or network dependency at all. That fact does real work in section 6.

**Deployment topology.** Three Railway services from one repo, deploying from `main`. Name the single environment as a decision: the dev/pre-prod/prod split was built completely and then reverted when it needed a paid plan. It reads as judgment when you say it and as an omission when you don't.

## 2. The design pass — ~45s

Do this before the feature demo, while the UI is still new, so the look registers on its own terms rather than as background to a workflow.

- **Register:** instrument panel / GPS watch face, not a wellness app. Light is the designed identity, not a dark-mode afterthought.
- **Type:** three roles — Big Shoulders Display, IBM Plex Sans, IBM Plex Mono — deliberately not Inter or Space Grotesk. Zoom in on numbers: mileage, pace, duration, RPE, dates all get a monospaced tabular register distinct from prose. For someone who reads a watch face all day, that was the highest-leverage typographic call in the app.
- **Signature element:** the phase arc. Computed client-side from `computePhaseBoundaries`, so it shows *this* plan's real base/build/peak/taper proportions rather than a decorative fixed shape.

## 3. Golden path — ~1 min 15s

Move briskly. This is the least distinctive part of the video and it's carrying setup for later sections, not making its own argument.

Sign in → intake → Schedule → log a session → dashboard.

- On **intake**: the feasibility check runs live in the browser, because `plan-engine` is a pure package the web app imports directly. It names a short runway and never blocks plan creation — a stated coaching judgment call, not a formula pretending to be science.
- On **Schedule**: tabs by phase, accordion by week. Scroll far enough to show strength sessions coordinating with running days rather than sitting beside them.
- On **logging**: click **"Log this" on a run row**, not the generic button. Type and planned duration arrive prefilled; distance is deliberately blank because the plan prescribes that run by duration. **Section 7 calls back to this exact click** — it has to be the one the audience sees.
- If a key is configured, trigger the **AI Coach** once and say what it is: a reactive comment on recent training, not the thing making the schedule safe.

## 4. What keeps it honest — ~40s

This was an explicit requirement in the brief — verification tooling running locally and in CI — and it's also the setup for section 7. Show it, don't describe it.

Split screen or cut between two things:

- **Locally:** `bun run check` — `tsc -b`, ESLint, Knip for dead code, then 77 unit tests. One command, and it's the pre-commit gate.
- **In CI:** a pull request with three required checks — `check`, `integration` (10 tests against a real Postgres via Testcontainers), and `e2e` (3 Playwright tests against the whole stack). All three must pass to merge into `main`. Every checkpoint in this project went in through one of these.

Say why the split exists: Testcontainers needs Docker and Playwright needs the stack running, so neither belongs in the fast local loop — but both are still required before anything merges.

**Do not oversell this.** The next-but-one section is about what it all missed, and that only works if you've been straight here.

## 5. The day-economy warning, on purpose — ~1 min

Build a plan with a deliberately tight day economy and let the warning fire on camera. **Use 4 running days / 1 bike day / "Follow a program"** — verified to produce both halves: 39 of 39 weeks understaffed, and Lower A / Lower B back-to-back in 33 of 39.

Two things while it's on screen:

1. It reports proportionally and honestly ("N of 39 weeks"), with no minimum threshold. A single bad week still gets named.
2. It exists because the alternative was what the code used to do — silently drop the session. This is the fix for a real bug, not a decorative banner.

Then the part worth slowing down for. That configuration was the app's own default. The plan for fixing it was to nudge the running and bike day counts. **Sweeping the whole configuration space through the check itself showed that was impossible** — the program needs four free days a week, every running or bike day consumes one, and exactly one configuration in the space keeps the full program. So the defaults split: the seeded demo gives up its bike day to keep the real program visible, and a new user's first plan defaults to a lighter custom program with an actual rest day.

The line to land: **the check overruled the plan, and nothing was thresholded or silenced to make the warning go away.** The warning was telling the truth the whole time — four sessions genuinely did not fit in two days.

## 6. One architecture story, told properly — ~1 min 15s

The swappable-program claim, tested by accident rather than by assertion.

The strength program is data; the scheduler is generic code reading constraints out of that data. Then a custom strength mode was requested, with no named program at all. That surfaced one boolean quietly doing two jobs — avoiding the day before a hard run, *and* enforcing spacing between paired sessions — which only worked because Glute Gladiator happened to need both together. Splitting it into two independent properties made custom mode trivial. Then running needed the same day-placement capability for its own frequency fix, and rather than write it a third time it was extracted into `packages/scheduling`, which both engines now depend on.

The line to land: the architecture held up under reuse nobody planned for, which is a better test than it holding up in the description of it.

## 7. What all of that still missed — ~1 min 15s

The payoff for section 4. Open by pointing back at it: every one of those checks was green.

**The "log this" action that only worked for lifts.** Call back to logging that run in section 3 — *that button did not exist for runs until the last checkpoint of this project.* It had been gated to strength sessions since the strength program was added, so every run, including the long run, had no way to be logged against its plan.

Three beats, in this order, because each makes the next worse:

1. **Nothing caught it.** Type checker satisfied. All 90 tests green. It survived a coach-persona and designer-persona review of the product.
2. **The decision log confidently recorded the opposite.** An earlier checkpoint justified leaving the full plan view read-only by citing this action's existence on the dashboard, treating the two as a deliberate matched pair. The pair never existed for runs. Be blunt: documentation asserting something false is worse than no documentation, and the log now says so next to the original decision, which still stands.
3. **The cost was invisible and downstream.** The Coach decides what you missed by checking whether a logged session links back to a planned one. A runner logging every session faithfully through the generic form — the only route they had — would have been told they'd missed all of them. And the seeded demo data sets that link directly, which is exactly why eight weeks of it never showed the problem.

The line to land: **it took a person clicking the thing.** No test could have found this, because the fixture that made the tests realistic was also the fixture that hid the bug.

Then two more, fast, as evidence this wasn't a one-off:

- **The six-week silent drop** — a strength session disappearing from weeks 31–36, visible only by reading a full 39-week plan end to end.
- **450 orphaned session logs** — the Coach reporting 80-plus-mile weeks on a plan whose longest run is 9.9 miles, traced to a foreign key set to null rather than cascade.

## 8. Close — ~30s

Name what isn't there, without hedging: no cutback weeks in base and build, a fixed peak long-run distance, strength progression that steps at block boundaries rather than week to week, interference rules that are correct but invisible in the UI, and no planned distance for runs prescribed by duration — the app now says so plainly wherever that number appears, which is not the same as having solved it.

Then close the loop opened in section 0. Every one of those was found, written down, and left visible rather than discovered by whoever used the app next — and the same is true of the three times the system proved me wrong on camera. Point at where it's all checkable: `DECISIONS.md` logs every real decision as it was made, the write-up was verified against the codebase before it was committed, and one claim in it didn't survive that check and was rewritten.
