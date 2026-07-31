# Cadenza — walkthrough video outline

Target length **5–8 minutes**. Structure follows [WRITEUP.md](./WRITEUP.md), so anything said here can be checked against that document and against [DECISIONS.md](../DECISIONS.md).

> **Record after Checkpoint 16 lands.** Sections 3 and 4 both depend on it: CP16 changes the intake and seed defaults so a fresh plan no longer trips the day-economy warning, which is exactly what makes section 4's deliberate demonstration land as a feature rather than as the app's ambient state.

---

## 0. Open — 20s

Name the persona in one sentence: a first-time marathoner who is also a seasoned lifter and an active cyclist. Say what the brief asked for (authenticated UI plus the ability to record a session, explicitly not feature-complete) and that everything past that was a deliberate choice. Sets up every "why did you build that" question before it's asked.

## 1. The diagram first — ~1 min

Screen share the README's two Mermaid diagrams. Do not open the app yet.

**Request flow.** Trace one call end to end: browser → oRPC client with a Clerk bearer token → Express → `clerkMiddleware` → `protectedProcedure` throwing `UNAUTHORIZED` before any handler runs → Zod input validation → handler → Prisma → Postgres → Zod output validation → typed response. The point to land: the frontend and backend share *one* contract, and the web app imports the router's type only.

Call out the pure packages hanging off the handler — `plan-engine`, `strength-engine`, both onto `scheduling` — and that they have no database or network dependency at all. That fact does real work later in the video.

**Deployment topology.** Three Railway services from one repo, deploying from `main`, with all three CI jobs required to merge. Name the single environment as a decision: the dev/pre-prod/prod split was built completely and then reverted when it turned out to need a paid plan. It reads as judgment when you say it and as an omission when you don't.

## 2. The design pass — ~1 min

Do this before the feature demo, while the UI is still new to the viewer, so the look registers on its own terms rather than as background to a workflow.

- **Register:** instrument panel / GPS watch face, not a wellness app. Light is the designed identity, not a dark-mode afterthought.
- **Type:** three roles — Big Shoulders Display, IBM Plex Sans, IBM Plex Mono — deliberately not Inter or Space Grotesk. Zoom in on numbers: mileage, pace, duration, RPE and dates all get a monospaced tabular register distinct from prose. For someone who reads a watch face all day, that was judged the highest-leverage typographic call in the app.
- **Signature element:** the phase arc on the dashboard. It's computed client-side from `computePhaseBoundaries`, so it shows *this* plan's real base/build/peak/taper proportions rather than a decorative fixed shape. Show two plans with different race dates side by side if the timing allows — the arc visibly changes.

## 3. Golden path — ~2 min

Sign in → intake → generated plan → log a session → dashboard.

- On **intake**: the feasibility check runs live in the browser, because `plan-engine` is a pure package the web app can import directly. Note out loud that it names a short runway and never blocks plan creation — it's a stated coaching judgment call, not a formula pretending to be science.
- On **the plan view**: tabs by phase, accordion by week, current week open by default. Scroll far enough to show the strength sessions coordinating with the running days rather than sitting beside them.
- On **logging**: record a real session and land back on the dashboard with planned vs. logged updated.
- If a key is configured, trigger the **AI Coach** once here and say plainly what it is: a reactive comment on the last two weeks, not the thing making the schedule safe. Its endpoint is allowed to fail; no key is a supported state.

## 4. The day-economy warning, on purpose — ~1 min

Build a plan with a deliberately tight day economy — enough running and bike days that the strength program cannot fit what it promises — and let the warning fire on camera.

Two things to say while it's on screen:
1. It reports proportionally and honestly ("N of 39 weeks"), with no minimum threshold before it speaks up. A single bad week still gets named.
2. It exists because the alternative was what the code used to do: silently drop a session. This is the fix for a real bug, not a decorative banner.

Then say explicitly that the app's *default* inputs were changed so a fresh plan doesn't trip it — a correct warning still shouldn't be the first thing a new user meets — and that the check itself was never touched or suppressed.

## 5. One architecture story, told properly — ~1.5 min

The swappable-program claim, and the fact that it was tested by accident rather than by assertion.

The strength program is data; the scheduler is generic code reading constraints out of that data. Then a custom strength mode was requested, with no named program at all. It surfaced that one boolean was quietly doing two jobs — avoiding the day before a hard run, *and* enforcing spacing between paired sessions — which only worked because Glute Gladiator happened to need both together. Splitting it into two independent properties made custom mode trivial. Then running needed the same day-placement capability for its own frequency fix, and rather than write it a third time it was extracted into `packages/scheduling`, which both engines now depend on.

The line to land: the architecture held up under reuse nobody planned for, which is a better test than it holding up in the description of it.

## 6. Bugs found by using the system — ~1 min

Two, told quickly:

- **The six-week silent drop.** Every unit test passed. Only reading a full 39-week generated plan showed that one strength session had been quietly disappearing for weeks 31–36, because that plan's specific day layout left it no legal day and the scheduler's fallback dropped it rather than degrade the rule.
- **450 orphaned session logs.** The AI Coach reported 80-plus-mile weeks on a plan whose longest run is 9.9 miles. Taking that seriously instead of writing it off as a model quirk led to a foreign key set to null rather than cascade on delete — every past reseed had stacked another full history behind the current one.

The through-line: both came from generating real output and looking at it, not from reading code in the abstract.

## 7. Close — ~30s

Name what isn't there, without hedging: no cutback weeks in base and build, a fixed peak long-run distance, strength progression that steps at block boundaries rather than week to week, scheduler interference rules that are correct but invisible in the UI, and a weekly mileage number that only reflects long-run distance because most runs are prescribed by duration.

End on why that list exists at all: every one of those was found, written down, and left visible rather than discovered by whoever used the app next.
