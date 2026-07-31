const labelClass = "text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

/**
 * Static reference content — no user input, no calculation, no personalization.
 * Ranges are the conventional endurance-sport guidance (see DECISIONS.md,
 * Checkpoint 14): deliberately coarse, because anything narrower would imply a
 * precision this page isn't doing the work to earn.
 */
const FUEL_TIERS = [
  {
    duration: "Under 60 min",
    carbs: "None needed",
    fluid: "Drink to thirst",
    detail:
      "Short enough to run on the glycogen you already have. Eating mid-run here is practice, not necessity — skip it unless you're deliberately rehearsing.",
  },
  {
    duration: "60–90 min",
    carbs: "~30 g / hour",
    fluid: "12–20 oz / hour",
    detail:
      "The range where fueling starts to matter. One gel or a few chews an hour is enough. This is the right place to find out which products your stomach tolerates.",
  },
  {
    duration: "90 min – 2:30",
    carbs: "30–60 g / hour",
    fluid: "16–24 oz / hour",
    detail:
      "Start fueling early — around the 30–40 minute mark — rather than waiting until you feel flat. Once you're depleted, you don't catch back up mid-run.",
  },
  {
    duration: "Over 2:30",
    carbs: "60–90 g / hour",
    fluid: "16–28 oz / hour",
    detail:
      "Above roughly 60 g/hour, mixed carb sources (glucose plus fructose) absorb better than a single source. Add sodium, especially in heat. Your gut needs training for this rate — build up to it over several long runs.",
  },
];

const TIMING = [
  {
    when: "2–3 hours before",
    what: "A familiar carb-forward meal, light on fat and fiber. 300–600 calories depending on run length.",
  },
  {
    when: "30–60 min before",
    what: "Optional small carb top-up if the pre-run meal was early or light — a banana, toast, a gel.",
  },
  {
    when: "During",
    what: "Per the table above, started early and taken on a schedule rather than by feel.",
  },
  {
    when: "Within ~60 min after",
    what: "Carbs plus protein together. The exact ratio matters less than not skipping it, especially with another session inside 24 hours.",
  },
];

const RACE_DAY = [
  "Nothing new on race day — not the gel, not the drink, not the breakfast. Every item should already have a long run behind it.",
  "Rehearse race fueling on your longest runs at goal-ish effort, not just on easy miles. Digestion changes with intensity.",
  "Know what's on the course and decide in advance whether you're using it or carrying your own.",
  "Practice taking fuel while moving. Slowing to a walk for every gel is a habit that costs you real time.",
];

export function Nutrition() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <header>
        <p className={labelClass}>Reference</p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Fueling</h1>
        <p className="mt-2 text-muted-foreground">
          General guidance by long-run duration. Nothing here is personalized to your plan — treat it
          as a starting point to test in training, and talk to a professional for individual advice.
        </p>
      </header>

      <section className="mt-8">
        <h2 className={labelClass}>During the run</h2>
        <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-card">
          {FUEL_TIERS.map((tier) => (
            <li key={tier.duration} className="px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="font-display text-base font-bold uppercase tracking-tight">
                  {tier.duration}
                </h3>
                <div className="flex items-baseline gap-4 font-mono text-sm text-muted-foreground">
                  <span>{tier.carbs}</span>
                  <span>{tier.fluid}</span>
                </div>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{tier.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className={labelClass}>Around the run</h2>
        <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-card">
          {TIMING.map((row) => (
            <li
              key={row.when}
              className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[11rem_1fr] sm:gap-4"
            >
              <span className="font-mono text-foreground">{row.when}</span>
              <span className="text-muted-foreground">{row.what}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className={labelClass}>Race day</h2>
        <ul className="mt-2 space-y-2 rounded-md border border-border bg-card p-4">
          {RACE_DAY.map((rule) => (
            <li key={rule} className="flex gap-3 text-sm text-muted-foreground">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
