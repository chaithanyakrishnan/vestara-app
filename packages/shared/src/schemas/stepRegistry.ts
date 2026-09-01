import { z } from "zod";
import { IdentityStepSchema } from "./identity";
import { ContributionsStepSchema } from "./contributions";
import { EligibilityStepSchema } from "./eligibility";
import { VestingStepSchema } from "./vesting";
import { AdministrationStepSchema } from "./administration";
import { TrusteesFundsStepSchema } from "./trusteesFunds";

/**
 * Single source of truth for wizard step order, keys, labels, and the Zod
 * schema each step must validate against. Both the API (on write) and the
 * web app (on submit) import this — there is exactly one place that defines
 * "what does step 3 look like."
 */
export const STEP_REGISTRY = [
  { key: "identity", index: 0, label: "Company & Plan", schema: IdentityStepSchema },
  { key: "contributions", index: 1, label: "Contributions", schema: ContributionsStepSchema },
  { key: "eligibility", index: 2, label: "Eligibility & Entry", schema: EligibilityStepSchema },
  { key: "vesting", index: 3, label: "Vesting", schema: VestingStepSchema },
  { key: "administration", index: 4, label: "Administration", schema: AdministrationStepSchema },
  { key: "trustees_funds", index: 5, label: "Trustees & Funds", schema: TrusteesFundsStepSchema },
] as const;

export type StepKey = typeof STEP_REGISTRY[number]["key"];

export const STEP_KEYS = STEP_REGISTRY.map((s) => s.key) as StepKey[];

export function schemaForStep(key: string): z.ZodTypeAny | undefined {
  return STEP_REGISTRY.find((s) => s.key === key)?.schema;
}

export const TOTAL_WIZARD_STEPS = STEP_REGISTRY.length + 1; // +1 for Review & Sign
