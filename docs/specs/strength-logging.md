# Spec — logging exercises the plan didn't prescribe

Status: **agreed, not implemented.** Written at Checkpoint 22; implementation is Checkpoint 23.

Scope note: this spec covers the *logging surface* only. `packages/strength-engine` is not touched — the program model is not the gap.

## The problem, stated accurately

Structured per-exercise logging **already exists**. Arriving at the log form from a planned LIFT row that carries prescribed exercises gives exercise names, prescribed sets/reps, coaching notes, per-set reps and weight inputs, and an "Add set" control. It is submitted as `setLog`, accepted by `setLogEntrySchema`, and rendered by History as "N exercises logged".

The August 2026 review claimed otherwise. It was wrong, and the correction is recorded beside the original finding.

What is actually missing is narrower: **there is no way to log an exercise the plan didn't prescribe.** The form's structured mode is gated on `isStructuredLift` — `linkedExercises && linkedExercises.length > 0` — so it is unavailable in exactly two places, both confirmed by observation:

| Situation | Observed |
|---|---|
| Custom-mode lift session, via "Log this" | Row reads `Lift session`; form shows 0 set rows |
| Freeform `/log`, type = Lift | Form shows 0 set rows |

These are one gap seen twice. It is also the reason Custom mode feels empty: `buildCustomProgram` deliberately prescribes no exercises, so its sessions can *never* reach structured logging under the current gate.

## Rules

1. **An exercise may be logged whether or not it was prescribed.** The prescription seeds the form; it does not limit it.
2. **Prescribed exercises are prefilled**, exactly as today, with their name, set count derived from `setsReps`, and notes. Unchanged behaviour.
3. **An "add exercise" affordance is always available** on a lift log — with a prescription, with an empty prescription, and with no linked workout at all.
4. **A user-added exercise is a free-text name plus set rows.** It is not matched against any catalogue, and no catalogue is introduced.
5. **Added and prescribed exercises are not distinguished in storage.** `setLog` records what was done; the prescription already records what was asked. Keeping a flag would create a second source of truth for a question already answerable by comparing the two.
6. **Nothing becomes required.** A lift session logged with no exercises at all stays valid — that is today's behaviour for freeform lifts and it must not regress into a forced form.
7. **Adherence is unaffected.** Whether a session counts as completed still depends on `plannedWorkoutId`, not on what is in `setLog`. The coach's missed-session logic must not start reading exercise detail.

## Inputs and outputs

**No schema change.** `setLogEntrySchema` already expresses what is needed:

```ts
{ exercise: string, sets: { reps: number (int, positive), weightLbs: number (non-negative) }[] }
```

`SessionLog.setLog` is `Json?`, so adding rows requires no migration. This was checked rather than assumed — the point of specifying inputs before writing code.

Two constraints worth naming because they bite at the edges:

- `reps` is a **positive integer**, so a set cannot be saved as 0 reps. An empty set row must be dropped before submit, not sent as zero.
- `weightLbs` is **non-negative**, so bodyweight movements legitimately record 0. Do not treat 0 as "unfilled".

## Entry points

Both converge on one form. There is no second logging surface.

| Arrived from | Prescription | Behaviour |
|---|---|---|
| Dashboard row, Glute Gladiator | Exercises present | Prefilled as today, plus "add exercise" |
| Dashboard row, Custom | `exercises: []` | Empty list, "add exercise" available, still links via `plannedWorkoutId` |
| `/log` freeform, type = Lift | None | Empty list, "add exercise" available, no link |

The Custom row already passes `plannedWorkoutId` — only the exercise fields are absent — so linking needs no new work.

## Edge cases the implementation must not fudge

- **An exercise with no sets.** Either drop it on submit or keep it as a named entry with an empty `sets` array. Pick one and say which; do not let it depend on render order.
- **A prescribed exercise the user skipped.** It must be removable, and removing it must not imply the session was missed — see rule 7.
- **A freeform lift log and the planned workout.** A user may lift on a planned day but reach the form via `/log`. This spec does **not** add plan-matching; the link is set only when arriving from a row. Called out so the absence is a decision rather than an oversight.
- **Switching type away from Lift** with exercises already entered. State must not silently persist into a run log.

## Custom mode's caption (#43, copy half)

Custom currently renders no explanatory text at all, while "Follow a program" names its program. The caption should say plainly that Custom reserves the days and leaves the programming to the user — which becomes true rather than aspirational once rule 3 lands.

Deliberately not claimed: that Cadenza will suggest exercises. Prescribing for non-Glute-Gladiator users is separate, larger work, already named in the write-up's what's-next as recommending a program from evolving goals.

## What does not change

- `packages/strength-engine/src/programs/custom.ts` — its exercise-free design is correct and documented; the gap was never in the program model
- History's "N exercises logged" summary — already producible by a real user
- The seed's `setLog` shape — it is the shape this spec preserves
- `setLogEntrySchema`, `logSessionInputSchema`, and the Prisma schema

## Verification the implementation will owe

- Log a Custom-mode session with two user-added exercises; confirm it persists and History reports "2 exercises logged"
- Log a Glute Gladiator session, remove one prescribed exercise and add one of your own; confirm both the removal and the addition survive a round trip
- Confirm a lift logged with no exercises still saves
- Confirm the coach's missed-session count is unchanged by any of the above
- Reintroduce the gate (`isStructuredLift`) and confirm the new e2e assertion fails
