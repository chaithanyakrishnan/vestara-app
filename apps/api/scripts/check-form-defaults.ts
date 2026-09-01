import { schemaForStep, PLAN_TYPES, planProfile, normalizeStepForPlanType } from "@vestara/shared";

/** The `defaults` objects each wizard step form is created with. */
const FORM_DEFAULTS: Record<string, any> = {
  vesting: {
    scheduleType: "6graded",
    customSchedule: [
      { yearLabel: "Less than 1", pct: 0 }, { yearLabel: "1", pct: 0 },
      { yearLabel: "2", pct: 20 }, { yearLabel: "3", pct: 40 },
      { yearLabel: "4", pct: 60 }, { yearLabel: "5", pct: 80 },
      { yearLabel: "6+", pct: 100 },
    ],
    normalRetirementAge: "65",
    vestingOnDeathDisability: "both",
  },
  contributions: {
    pretaxDeferrals: true, rothDeferrals: true,
    catchupPermitted: "yes", catchupMatched: "no",
    safeHarborElected: false, matchElected: false, nonelectiveElected: false,
    forfeitureUse: "reduce_ne",
    compensationDefinition: "w2", compensationPostSeverance: "include", compensationExclusions: [],
  },
  // What an existing draft looks like after a safe harbor was toggled on
  "contributions (safe harbor on)": {
    pretaxDeferrals: true, rothDeferrals: true,
    catchupPermitted: "yes", catchupMatched: "no",
    safeHarborElected: true, safeHarborType: "basic",
    matchElected: false, nonelectiveElected: false,
    forfeitureUse: "reduce_ne", compensationDefinition: "w2",
  },
  administration: {
    loansPermitted: false, inServiceAt59_5: false, hardshipElected: false,
    rolloversAccepted: true, rolloverSources: "all",
    planExpensePayer: "plan", requiredBeginningAge: "73",
  },
};

for (const t of PLAN_TYPES) {
  console.log(`\n=== ${planProfile(t).label}`);
  for (const [label, data] of Object.entries(FORM_DEFAULTS)) {
    const key = label.split(" ")[0];
    // Exactly what the form does on hydration.
    const hydrated = normalizeStepForPlanType(key, data, t);
    const r = schemaForStep(key, t)!.safeParse(hydrated);
    if (r.success) { console.log(`  ok   ${label}`); continue; }
    console.log(`  REJ  ${label}`);
    for (const i of r.error.issues) console.log(`         ${String(i.path[0])}: ${i.message.slice(0, 95)}`);
  }
}
