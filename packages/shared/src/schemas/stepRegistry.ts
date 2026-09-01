import { z } from "zod";
import { IdentityStepSchema, buildIdentitySchema } from "./identity";
import { ContributionsStepSchema, buildContributionsSchema } from "./contributions";
import { EligibilityStepSchema, buildEligibilitySchema } from "./eligibility";
import { VestingStepSchema, buildVestingSchema } from "./vesting";
import { AdministrationStepSchema, buildAdministrationSchema } from "./administration";
import { TrusteesFundsStepSchema, buildTrusteesFundsSchema } from "./trusteesFunds";
import { planProfile } from "./planProfile";

/**
 * Single source of truth for wizard step order, keys, labels, and the Zod
 * schema each step must validate against. Both the API (on write) and the
 * web app (on submit) import this — there is exactly one place that defines
 * "what does step 3 look like."
 *
 * Each step now carries a BUILDER as well as a default schema. The default is
 * 401(k)-shaped and keeps older callers compiling; the builder is what makes
 * the wizard plan-type aware, so a 401(a) is not asked for elective deferrals
 * and a non-governmental 457(b) is not asked for a trustee.
 */
export const STEP_REGISTRY = [
  {
    key: "identity",
    index: 0,
    label: "Company & Plan",
    schema: IdentityStepSchema,
    build: buildIdentitySchema,
  },
  {
    key: "contributions",
    index: 1,
    label: "Contributions",
    schema: ContributionsStepSchema,
    build: buildContributionsSchema,
  },
  {
    key: "eligibility",
    index: 2,
    label: "Eligibility & Entry",
    schema: EligibilityStepSchema,
    build: buildEligibilitySchema,
  },
  {
    key: "vesting",
    index: 3,
    label: "Vesting",
    schema: VestingStepSchema,
    build: buildVestingSchema,
  },
  {
    key: "administration",
    index: 4,
    label: "Administration",
    schema: AdministrationStepSchema,
    build: buildAdministrationSchema,
  },
  {
    key: "trustees_funds",
    index: 5,
    label: "Trustees & Funds",
    schema: TrusteesFundsStepSchema,
    build: buildTrusteesFundsSchema,
  },
] as const;

export type StepKey = (typeof STEP_REGISTRY)[number]["key"];

export const STEP_KEYS = STEP_REGISTRY.map((s) => s.key) as StepKey[];

/**
 * Pass the plan type wherever it is known. Omitting it validates against the
 * 401(k) shape, which is the safe default for a draft whose identity step has
 * not been filled in yet.
 */
export function schemaForStep(key: string, planType?: string): z.ZodTypeAny | undefined {
  const step = STEP_REGISTRY.find((s) => s.key === key);
  if (!step) return undefined;
  return planType ? step.build(planType) : step.schema;
}

/**
 * The label for a step can depend on the plan type — "Trustees & Funds" is
 * wrong for a 403(b), which has a custodian, and for an unfunded 457(b).
 */
export function labelForStep(key: string, planType?: string): string {
  const step = STEP_REGISTRY.find((s) => s.key === key);
  if (!step) return key;
  if (key === "trustees_funds" && planType) {
    const p = planProfile(planType);
    if (p.fundingVehicle === "custodial_annuity") return "Custodian & Funds";
    if (p.fundingVehicle === "unfunded") return "Investments & Fiduciaries";
  }
  return step.label;
}

export const TOTAL_WIZARD_STEPS = STEP_REGISTRY.length + 1; // +1 for Review & Sign
