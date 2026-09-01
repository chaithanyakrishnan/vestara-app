/**
 * Validates MOCK_EXTRACTION against the real step schemas — the same
 * safeParse that applyExtractionToPlan runs.
 *
 * This repo has no test runner, so this stands in as the regression guard for
 * the extraction payload. Sections that fail validation are silently dropped
 * into `skippedSections` at runtime, which surfaces to the user as "the
 * document wasn't read fully" with no error anywhere. Run after any edit to
 * mockExtraction.ts or to a step schema:
 *
 *   npm run verify:extraction --workspace=@vestara/api
 */
import { schemaForStep, STEP_KEYS } from "@vestara/shared";
import { MOCK_EXTRACTION } from "../src/modules/extraction/mockExtraction";
import { splitConfidence } from "../src/modules/extraction/extraction.service";
import { validateCustomVestingSchedule } from "../src/modules/plans/irsVestingFloor";

const mock = MOCK_EXTRACTION as Record<string, unknown>;
let failures = 0;

console.log(`Validating MOCK_EXTRACTION against ${STEP_KEYS.length} step schemas\n`);

for (const stepKey of STEP_KEYS) {
  const section = mock[stepKey];

  if (section === undefined) {
    console.log(`  MISSING  ${stepKey} — no such key; would be skipped without being reported`);
    failures++;
    continue;
  }

  // `_confidence` is stripped by applyExtractionToPlan before validation, so
  // strip it here too or every section would fail on an unknown key.
  const { data, confidences } = splitConfidence(section);
  const result = schemaForStep(stepKey)!.safeParse(data);
  if (!result.success) {
    console.log(`  FAIL     ${stepKey}`);
    for (const issue of result.error.issues) {
      console.log(`             ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    failures++;
    continue;
  }

  // The vesting step carries a business rule the schema deliberately defers.
  if (stepKey === "vesting") {
    try {
      validateCustomVestingSchedule(result.data as never);
    } catch (err) {
      console.log(`  FAIL     ${stepKey} — IRS floor: ${(err as Error).message}`);
      failures++;
      continue;
    }
  }

  const fieldCount = Object.keys(result.data as object).length;
  const scored = confidences ? Object.keys(confidences).length : 0;
  const weak = confidences ? Object.values(confidences).filter((c) => c < 0.7).length : 0;
  console.log(
    `  ok       ${stepKey} (${fieldCount} fields, ${scored} scored${weak ? `, ${weak} below 0.70` : ""})`,
  );
}

// The normalized PlanTrustee table is fed from this separate top-level key.
if (!Array.isArray(mock.trustees) || mock.trustees.length === 0) {
  console.log("  FAIL     trustees — top-level array missing; no PlanTrustee rows would be written");
  failures++;
} else {
  console.log(`  ok       trustees (${(mock.trustees as unknown[]).length} row(s) -> PlanTrustee)`);
}

if (failures > 0) {
  console.log(`\n${failures} section(s) would be dropped. The wizard would appear partly unfilled.`);
  process.exit(1);
}
console.log("\nAll sections validate — a mock extraction pre-fills the whole wizard.");
