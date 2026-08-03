# Cadenza — walkthrough script

Target **5–8 minutes**. The script is **~1,390 spoken words**, which is **8:10 brisk / 9:15 measured — over the target.** Taking the marked cut in section 7 gets it to ~1,345, or **7:55 / 8:55.** Still tight.

**To land comfortably inside eight minutes, cut roughly 150 more words.** Ranked by what costs least:

1. **Section 3, the golden path** (154 words / ~0:58). Lowest value per second in the video — signing in and filling a form is table stakes, and sections 5 and 7 re-show the parts that matter. Cutting it to ~100 words is the cheapest 20 seconds available.
2. **Section 7's "two others"** (45 words, already marked). Take this regardless.
3. **Section 1's deployment paragraph** (~55 words). The diagram is on screen saying most of it; you could land it in one sentence.

Don't buy time from sections 5, 7's main story, or 8 — those are the argument.

Actual spoken length per section is listed in each heading, and they're measured from the script rather than estimated. Every factual claim is checkable against [WRITEUP.md](./WRITEUP.md) and [DECISIONS.md](../DECISIONS.md).

**The through-line:** stated in section 0, closed in section 8 — *everything here is checkable, and the places where the system proved me wrong are in the record.* Sections 5, 7 and 8 are the evidence. Without that spine this is a competent tour; with it, it's an argument.

## How to read this

- **Everything in a `>` blockquote is spoken aloud, and nothing else is.** If it isn't quoted, don't say it.
- **On screen / Do** — what to show and what to click.
- **Note —** direction for you, never spoken.

## Before you record anything

**1. Reseed. This is not optional.**

```
bun run --filter '@firstloop/db' db:seed
```

The app shows the *most recently created* plan for a user. Every plan you create — including every CI run of the e2e suite — becomes that plan. Left alone, the dashboard ends up showing a plan generated today with no history, instead of the demo persona nine weeks into training. Reseeding clears that user's plans and logs and rebuilds the canonical one.

Expect two lines, roughly:

```
Seeded plan <id> (38 weeks, 266 planned workouts) with 53 logged sessions for firstloop_test+clerk_test@example.com
  Left the 2026-08-02 long run unlogged so the coach has a concern to flag.
```

**2. Note the week count and read it off the screen, don't recite it.** The plan length is computed from today's date, so it drifts — it was 39 weeks when this script was drafted and 38 when it was last checked. Sections 3 and 5 both mention it; say whatever the screen says.

**3. Record sections 3 and 5 LAST.** Both create a plan, and creating a plan buries the seeded demo. Order:

| Order | Sections | State needed |
|---|---|---|
| First | 0, 1, 2, 4, 6, 7, 8 | Freshly seeded — demo nine weeks in, real logged history |
| Last | 3, then 5 | Each creates a plan; nothing after them depends on the seed |

If you re-take anything from the first group afterwards, **reseed again first.**

**4. Have open before you roll:** the app signed in as the demo account; a terminal at the repo root; the CI run page (URL in section 4); the README on GitHub (URL in section 1).

**5. Everything is recorded and cut** — nothing here is live, so take sections separately and as many times as you like.

**6. Read the script out loud once first.** Anything that trips you is a line to rewrite, not to power through.

---

## 0. Open — 0:50

**On screen:** the **Dashboard** page, signed in as the demo account, scrolled to the top so the header block and the phase arc are both visible — `WEEK 9 OF 38` / `BASE PHASE` on the left, `RACE DAY 2/27/2027` on the right, the arc below. Don't scroll, don't click.

**Note —** the middle paragraph is the rubric, delivered fast and flatly. It works *because* it sets up the turn that follows it: the checklist is table stakes, and saying so out loud is what earns the "but" in the third paragraph. Deliver it as a list you're getting out of the way, not as a boast — the moment it sounds like selling, it reads as defensive.

**Say:**

> This is Cadenza — a marathon training app for a first-time marathoner who's also a serious lifter and rides most weeks.
>
> Quickly, against what was asked for. Monorepo on the named stack, deployed to Railway as three separate services — database, backend, frontend. Verification runs locally and in CI. Auth is Clerk. The client update — diagram, write-up, this video — is in the repo, which is public, alongside a live URL. It asked for an authenticated UI where you can record a session, and said it needn't be feature-complete; I built past that deliberately. The one thing I skipped is the optional Terraform bonus.
>
> But the part worth your time isn't the checklist. It's the number of times this system caught something I'd got wrong — and the fact that all of it is written down.

---

## 1. The shape of it — 0:50

**On screen:** the README on GitHub. Don't open the app at all in this section.

**Setup:**
1. Open **https://github.com/lizorsini54/firstloop-marathon-app/blob/main/README.md**
2. **Collapse the file-tree sidebar** — the toggle sits immediately left of "Files", top left. Recovers about a quarter of the frame.
3. Scroll to the **Architecture** heading, then the **Request flow** subheading beneath it.
4. **Zoom the browser** to ~150% (`Cmd +` two or three times). Browser zoom scales the node labels; the diagram's own zoom control only scales it inside a fixed-height frame and leaves the text small.
5. Keep GitHub in **light theme** — section 2 argues light is the designed identity, and a dark frame here undercuts that in the first minute.

**Do:** as you trace the request, **pan along the path** rather than trying to hold the whole diagram in frame: `Browser — apps/web` → `apps/server — Express` → `packages/contracts` → `Data and external`. That's left-to-right, matching the order the lines below read in.

**Say:**

> Before the app, the architecture. One request.
>
> The browser calls an oRPC client that attaches a Clerk bearer token. Express hands it to Clerk's middleware, then to a protected procedure that throws Unauthorized before any handler runs. Zod validates the input, the handler reaches Postgres through Prisma, and Zod validates what comes back.
>
> Frontend and backend share one contract — the web app imports the router's *type*, never its implementation.
>
> And these three packages hanging off the handler touch no database and no network at all. That matters later.

**Do:** scroll down to the **Deployment topology** subheading. This diagram is laid out left-to-right and fits the frame without panning — three boxes: `Local development`, `GitHub`, `Railway — one environment, deploys from main`.

> Three Railway services from one repo, deploying from main. One environment — I built the full dev, pre-prod and prod split, then reverted it when it turned out to need a paid plan. That's in the decisions log as a cost tradeoff, not an omission.

---

## 2. The design — 0:45

**On screen:** back to the app, **Dashboard** page, demo account. Three specific things in this order:

1. **The header block** — `WEEK 9 OF 38` and `BASE PHASE` in the condensed display face, `RACE DAY / 2/27/2027` on the right in mono. Both registers in one frame.
2. **The `THIS WEEK'S PLAN` table** — zoom in on the right-hand column (`30min · easy`, `10.1mi · long`, `Lower A: Glute + Hinge Strength · Peak block · 6 exercises`). This is where the mono-for-numbers argument is most visible: every duration, distance and count is tabular and set apart from the day and type columns.
3. **The phase arc**, the band directly under the header with `BASE`, `BUILD`, `PEAK`, `TAPER` along the bottom and an orange dot marking the current week.

**Note —** if you want the arc's proportions to be obviously plan-specific, open **Schedule** for a second: the tab row there reads `Base 15 / Build 13 / Peak 6 / Taper 4`, which is the same shape as the arc, in numbers. Optional; costs about eight seconds.

**Say:**

> A quick word on the look, because it's deliberate. The register I wanted was instrument panel — a GPS watch face, not a wellness app.
>
> Three typefaces doing three jobs: a condensed display face for headings, a humanist sans for prose, and a mono for every number. Mileage, pace, duration, RPE, dates — all tabular, all visually separate from words. For someone who reads a watch face every day, that was the highest-leverage call in the design.
>
> And this arc is the signature element. It's computed from the real plan, so those base, build, peak and taper proportions are *this* plan's, not a decorative shape.

---

## 3. Using it — 1:15

Move briskly. This is the least distinctive part of the video and it's setting up sections 5 and 7.

**Record this section second-to-last** — it creates a plan, which replaces the seeded demo.

### Step 1 — open the goal form

**Do:** click **Goal** in the nav (last item, right-hand end). The page heading reads `SET YOUR GOAL`, with "We'll build the weeks back from your race day and current routine." underneath.

**Note —** the route is `/intake` and the code calls it intake, but nothing in the UI says that word. Call it "the goal form" or just "here" on camera.

### Step 2 — fill in exactly two fields

Everything else is already set to a sensible default and you should visibly leave it alone — that's the point being made.

| Field | What to do |
|---|---|
| `RACE DATE` | Type a date **9–12 months out**. Far enough that no feasibility warning fires. |
| `RUNNING EXPERIENCE` | Leave — defaults to `I've finished one before` |
| `CURRENT WEEKLY MILEAGE` | Type `20` |
| `CURRENT RUNNING DAYS PER WEEK` | Leave — `3` |
| `STRENGTH TRAINING` | Leave — `Custom` |
| `LIFT DAYS PER WEEK` | Leave — `2` |
| `BIKE DAYS PER WEEK` | Leave — `1` |
| `INJURY FLAGS` | Leave all unchecked |

**Optional, ~10 seconds, and it's the only way to show the live check working:** before typing the real race date, type one about **three months out** and let the amber feasibility warning appear under the form, then change it to the real date and watch it disappear. Without this the "runs in the browser as I type" line has nothing behind it.

**Say:**

> Now the product. A race date and my current weekly mileage.
>
> This feasibility check runs in the browser as I type, because the plan engine is a pure package the web app imports directly — and the server runs the same function again when the plan is created. It tells you if your runway is short, and it never blocks you. That's a coaching judgment call, and I've labelled it as one rather than dressing it up as science.

### Step 3 — generate

**Do:** click **Generate plan**. With these inputs there are no warnings, so it goes **straight to the Dashboard** — no intermediate screen. (If a warning does fire, the page stays put, shows it, and offers a `Continue to dashboard` link. That means your race date was too close; that path belongs in section 5, not here.)

### Step 4 — the Schedule page

**Do:** click **Schedule** in the nav. The page heading reads `FULL PLAN`. Point at, in order:

1. The **phase tab row** — `Base 15 / Build 13 / Peak 6 / Taper 4`.
2. The **week list** below it, each row summarised as `Long run 7.7mi · 4 lifts`.
3. **Expand week 1** (or whichever is marked `CURRENT`) and let the day rows show: two `Run` days, the `Lift` sessions, and the long run on Sunday.

**Say** — read the week count off the screen rather than reciting a number:

> Thirty-eight weeks. Tabs by phase, weeks inside them. And the strength sessions are placed *around* the running, not beside it — the scheduler knows which days are hard.

**Note —** no row here has a "Log this" action, and that's deliberate: this view is read-only. Don't draw attention to it; section 7 is where that matters.

### Step 5 — log a run from its row

**Do:** click **Dashboard**, then find the **first `Run` row** in `THIS WEEK'S PLAN` (Monday) and click its **`Log this`** link on the right-hand end of that row. Do **not** use the blue `Log a session` button at the bottom of the page — that's the generic path and it's the wrong one for this story.

**Do:** on the `LOG A SESSION` form that opens, point out before typing anything:
- `TYPE` is already set to `Run`
- `DURATION (MINUTES)` is already filled with the planned figure (`30`)
- `DISTANCE (MILES, OPTIONAL)` is empty

**Do:** fill in `RPE (1-10)` if it isn't already at `5`, then click **Log session**. You land back on the Dashboard and the session appears under `LOGGED THIS WEEK`.

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

**Record this section last.** It creates another plan.

**Do:** click **Goal** again. Set these three, leaving everything else:

| Field | Value |
|---|---|
| `RACE DATE` | Same 9–12 months out |
| `CURRENT WEEKLY MILEAGE` | `20` |
| `CURRENT RUNNING DAYS PER WEEK` | **`4`** |
| `STRENGTH TRAINING` | **`Follow a program`** |
| `BIKE DAYS PER WEEK` | **`1`** |

**Note —** selecting `Follow a program` hides the `LIFT DAYS PER WEEK` field, since the program dictates its own session count. That's expected, not a glitch.

**Say:**

> Here's a plan built to fail. Four running days, a bike day, and the full strength program.

**Do:** click **Generate plan**. Because this configuration warns, the page **stays on the goal form** and renders the warning in an amber panel just above the button, with a `Continue to dashboard` link. Let it sit on screen while you talk. Don't click through yet.

**Note —** read the two numbers **off the banner**, don't recite them. It says "N of N weeks get fewer sessions than planned" and names Lower A / Lower B landing back-to-back in a second count. The totals move with the plan length, which is computed from today's date.

> There it is. It's telling me the schedule can't fit what it promised. Every week of the plan comes up short on sessions, and two lower-body days land back to back in most of them.
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

**On screen:** the editor, two files side by side. This is the only code-reading section, so make the split obvious.

- **Left:** `packages/strength-engine/src/programs/glute-gladiator.ts`, scrolled to the `sessions:` array (line 27). You want `name: "LOWER_A"`, `displayName`, `respectsInterference`, `spacingGroup`, and the `exercises` list with real movement names and coaching notes on screen. This is the *data*.
- **Right:** `packages/scheduling/src/place.ts`, at `export function placeSlots` (line 24). This is the *code* — and nothing in it mentions Glute Gladiator, lifting, or running.

**Note —** the point lands visually before you say it: one file is full of domain content, the other has none. If you'd rather show one thing, show `place.ts` and say what isn't in it.

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

## 7. What all of that still missed — 1:55 (1:40 with the cut)

**On screen:** the **Dashboard**, scrolled so the whole `THIS WEEK'S PLAN` table is in frame. You want all seven rows visible at once, because the argument is about which rows have the action and which don't.

**Do:** as you say "that button did not exist for runs", **point along the right-hand column** — `Log this` on Monday's Run, Tuesday's Run, the four Lift rows, and Sunday's long run. The claim is that until the last checkpoint only the Lift rows had it, so it helps to trace the whole column rather than gesture at one row.

**Note —** don't try to demonstrate the bug live. The fix is merged; the old behaviour doesn't exist to show. You're narrating over the fixed state, which is honest as long as you say "did not exist" in the past tense, as the script does.

**Optional, if you want the receipt on screen:** have `e2e/log-from-plan-row.spec.ts` open in a second tab and cut to it on the "there's a ninety-first test now" line. The file's opening comment is the whole story in a paragraph.

**Say:**

> Everything I just showed you was green. Here's what got past it.
>
> Remember that click — logging a run from the dashboard. That button did not exist for runs until the final checkpoint of this project. It had been there for strength sessions only, since the day I added the strength program.

**Three beats. Each one makes the next worse.**

> Nothing caught it. Types fine, ninety tests passing, and it survived a review where I had two personas actually use the product rather than read the code.

**Then the payoff — say this immediately after, don't leave it implied:**

> There's a ninety-first test now. It clicks that button on a run row and fails if it ever goes missing. I checked that by putting the bug back — and while the new test failed, the original golden-path test still passed. Which is exactly why nothing caught this the first time.
>
> Second — my own decision log said the opposite. An earlier checkpoint justified leaving another view read-only *because the dashboard already had this action*. It didn't, for runs. Documentation asserting something false is worse than none, and the log now says that, next to the original decision, which still stands.
>
> Third, the real cost. The coach works out what you missed by checking that link back to the plan. Someone logging every run faithfully, through the only route they had, would have been told they'd missed all of them. And the seed data sets that link directly — which is precisely why eight weeks of demo data never showed it.

**Beat.**

> It took a person clicking the thing. The fixture that made the tests realistic was the same fixture hiding the bug.

**Fast, as evidence it wasn't a one-off.** ⚠️ ***Cut this if you need the time.*** Since the rubric paragraph went into section 0, this is the budget's only remaining slack — dropping it is what keeps the video under eight minutes at a measured pace. The section lands fine without it.

> Two others. A strength session silently vanishing from weeks thirty-one to thirty-six, visible only by reading a full plan end to end. And four hundred and fifty orphaned session logs — the coach reporting eighty-mile weeks on a plan whose longest run is under ten.

---

## 8. Close — 1:00

**On screen:** stay on whatever section 7 left up for the first paragraph — the close should feel like it's continuing a thought, not starting a new segment.

**Do:** on "written down too", cut to `DECISIONS.md` and scroll slowly through it. Don't stop anywhere in particular; the point is its length and that every section is headed by a checkpoint. It's the evidence for the final claim, so it should be on screen while you make it.

**Do:** cut back to the **Dashboard** for the last line, so the video ends on the product.

**Note —** the shape here is: *why those three stories* → *why I built past the brief* → *what's missing* → *where to check*. Limitations come third, not first. Opening the close on what's absent is what made the old version sag.

**Say:**

> So — why those three things, out of everything I could have shown you?
>
> Because they're where the system pushed back. A check that proved my own fix plan impossible. An architecture claim tested by a requirement I hadn't planned for. And a bug that sat in plain sight for eight checkpoints while my own notes claimed the opposite.
>
> I built past the brief deliberately — not to pad a demo, but because "sign in and record a session" puts no pressure on the design. Coordinating three disciplines across thirty-eight weeks does, and pressure is the only thing that shows you whether the judgment holds.
>
> What's missing is written down too. No cutback weeks. A fixed peak long run. Spacing rules that are correct but invisible in the interface. Named, so you're not the one who finds them.
>
> It's all in the decisions log — written when it happened, not reconstructed for this video. That's the part I'd check.
