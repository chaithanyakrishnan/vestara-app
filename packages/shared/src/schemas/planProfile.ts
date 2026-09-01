/**
 * What each plan type actually is, expressed as capabilities.
 *
 * This is the file that makes the wizard plan-type aware. Before it, `planType`
 * was recorded and displayed but branched nothing: all five types were asked
 * the identical 401(k) questions, which blocked 401(a) entirely (no elective
 * deferrals) and demanded a trustee from plans that must not have a trust.
 *
 * The rule is: NOTHING outside this file hardcodes "if planType === ...".
 * Schemas, forms and the review screen all read a capability flag instead, so
 * adding a sixth plan type means adding one entry here.
 */

import { IRS_LIMITS } from "./irsLimits";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

export const PLAN_TYPES = ["401k", "403b", "457b_gov", "457b_nongov", "401a"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

/** How plan assets are held. Drives the whole Trustees & Funds step. */
export type FundingVehicle =
  | "trust" // ERISA trust, trustee required
  | "trust_required" // governmental 457(b): Section 457(g) trust, mandatory
  | "custodial_annuity" // 403(b): Section 403(b)(7) custodial account or Section 403(b)(1) annuity
  | "unfunded"; // non-governmental 457(b): employer's general assets, NO trust

export type CatchUpKind =
  | "age50" // Section 414(v)
  | "super60to63" // SECURE 2.0 Section 109
  | "service15" // Section 402(g)(7), 403(b) only
  | "final3"; // Section 457(b)(3), 457(b) only

export interface PlanProfile {
  key: PlanType;
  label: string;
  /** Shown in the dropdown. */
  optionLabel: string;
  /** The lead line of the description panel under the selector. */
  headline: string;
  /** The product owner's description copy for this type. */
  summary: string;
  /** Extra points rendered as bullets under the summary. */
  notes: string[];

  // ---- contributions ----
  /** Whether the plan has an employee elective deferral feature at all. */
  electiveDeferrals: boolean;
  /** Section 402A designated Roth. NOT available to non-governmental 457(b). */
  rothAvailable: boolean;
  employerMatch: boolean;
  employerNonelective: boolean;
  /** ADP/ACP safe harbor is a Section 401(k) construct only. */
  safeHarborAvailable: boolean;
  /** Whether ADP/ACP testing applies (and so a testing-method election is needed). */
  adpAcpTesting: boolean;
  availableCatchUps: CatchUpKind[];
  /**
   * Governmental 457(b): the Section 457(b) limit is a SINGLE annual ceiling covering
   * employee deferrals AND employer contributions together, unlike Section 415(c).
   */
  combinedEmployeeEmployerLimit: boolean;

  // ---- eligibility ----
  /** 403(b) universal availability: deferrals must be offered to substantially all. */
  universalAvailability: boolean;
  /** Whether age/service conditions may be imposed on the deferral source. */
  ageServiceConditionsOnDeferrals: boolean;
  /** Non-governmental 457(b) must be limited to a select management group. */
  topHatOnly: boolean;
  autoEnrollmentAvailable: boolean;

  // ---- vesting ----
  /** Whether the Section 411(a)(2)(B) minimum vesting floors apply. */
  erisaVestingFloors: boolean;
  /** Deferrals are always 100% vested where they exist. */

  // ---- administration ----
  loansAvailable: boolean;
  hardshipAvailable: boolean;
  /** Section 457(b) uses "unforeseeable emergency", a stricter and distinct standard. */
  unforeseeableEmergency: boolean;
  inServiceAt59_5: boolean;
  /** 457(b) distributions are not subject to the Section 72(t) 10% early penalty. */
  earlyWithdrawalPenalty: boolean;

  // ---- funding ----
  fundingVehicle: FundingVehicle;
  requiresTrustee: boolean;
  /** ERISA Section 404(c) participant-direction relief is available to claim. */
  erisa404cAvailable: boolean;
  /** Whether the plan files a Form 5500 (drives plan number requirement). */
  files5500: boolean;
}

export const PLAN_PROFILES: Record<PlanType, PlanProfile> = {
  "401k": {
    key: "401k",
    label: "401(k)",
    optionLabel: "401(k) — Private / for-profit employer",
    headline: "401(k) — qualified cash or deferred arrangement",
    summary:
      "Elective deferrals are subject to ADP testing unless a safe harbor is adopted. " +
      "Employer contributions and deferrals share the Section 415(c) annual additions limit. " +
      "Deferrals must be deposited as soon as they can reasonably be segregated from " +
      "general assets — no later than the 15th business day of the following month, " +
      "which is an outer limit and not a safe harbor.",
    notes: [
      "Elective deferrals are always 100% vested; employer money may use a vesting schedule.",
      "Plans established after 29 December 2022 generally must auto-enrol under SECURE 2.0 Section 101.",
    ],
    electiveDeferrals: true,
    rothAvailable: true,
    employerMatch: true,
    employerNonelective: true,
    safeHarborAvailable: true,
    adpAcpTesting: true,
    availableCatchUps: ["age50", "super60to63"],
    combinedEmployeeEmployerLimit: false,
    universalAvailability: false,
    ageServiceConditionsOnDeferrals: true,
    topHatOnly: false,
    autoEnrollmentAvailable: true,
    erisaVestingFloors: true,
    loansAvailable: true,
    hardshipAvailable: true,
    unforeseeableEmergency: false,
    inServiceAt59_5: true,
    earlyWithdrawalPenalty: true,
    fundingVehicle: "trust",
    requiresTrustee: true,
    erisa404cAvailable: true,
    files5500: true,
  },

  "403b": {
    key: "403b",
    label: "403(b)",
    optionLabel: "403(b) — Non-profit / public school / hospital",
    headline: "403(b) — tax-sheltered annuity",
    summary:
      "403(b) requirements: Universal availability rule applies - elective deferrals must be " +
      "offered to substantially all employees. 15-year catch-up may apply to employees with " +
      "15+ years of service at qualifying organizations. Remit deferrals within earliest " +
      "practicable date but no later than 15 business days after month-end.",
    notes: [
      "Assets are held in a Section 403(b)(7) custodial account or a Section 403(b)(1) annuity contract — there is no trustee.",
      "Not subject to ADP testing, so the 401(k) safe harbor does not apply; ACP testing applies to employer match in an ERISA plan.",
      "A non-ERISA plan (most public school and light-touch church plans) files no Form 5500 and has no Section 404(c) relief to claim.",
    ],
    electiveDeferrals: true,
    rothAvailable: true,
    employerMatch: true,
    employerNonelective: true,
    safeHarborAvailable: false,
    adpAcpTesting: false,
    availableCatchUps: ["age50", "super60to63", "service15"],
    combinedEmployeeEmployerLimit: false,
    universalAvailability: true,
    ageServiceConditionsOnDeferrals: false,
    topHatOnly: false,
    autoEnrollmentAvailable: true,
    erisaVestingFloors: true,
    loansAvailable: true,
    hardshipAvailable: true,
    unforeseeableEmergency: false,
    inServiceAt59_5: true,
    earlyWithdrawalPenalty: true,
    fundingVehicle: "custodial_annuity",
    requiresTrustee: false,
    erisa404cAvailable: true,
    files5500: true,
  },

  "457b_gov": {
    key: "457b_gov",
    label: "457(b) Governmental",
    optionLabel: "457(b) Governmental — State / local government",
    headline: "457(b) Governmental — eligible deferred compensation plan",
    summary:
      `457(b) Governmental: The single annual limit (${usd(IRS_LIMITS.electiveDeferral)}) applies to the ` +
      "COMBINED total of employee deferrals AND employer contributions. Assets must be held in trust. " +
      "Distributions may be taken at separation without age penalty.",
    notes: [
      "Not subject to the Section 72(t) 10% early distribution penalty at any age.",
      "A special final-three-years catch-up can double the annual limit, but cannot be combined with the age-50 catch-up in the same year — the participant uses whichever is greater.",
      "ADP/ACP testing does not apply, and neither do the Section 411 minimum vesting schedules.",
    ],
    electiveDeferrals: true,
    rothAvailable: true,
    employerMatch: true,
    employerNonelective: true,
    safeHarborAvailable: false,
    adpAcpTesting: false,
    availableCatchUps: ["age50", "super60to63", "final3"],
    combinedEmployeeEmployerLimit: true,
    universalAvailability: false,
    ageServiceConditionsOnDeferrals: true,
    topHatOnly: false,
    autoEnrollmentAvailable: true,
    erisaVestingFloors: false,
    loansAvailable: true,
    hardshipAvailable: false,
    unforeseeableEmergency: true,
    inServiceAt59_5: true,
    earlyWithdrawalPenalty: false,
    fundingVehicle: "trust_required",
    requiresTrustee: true,
    erisa404cAvailable: false,
    files5500: false,
  },

  "457b_nongov": {
    key: "457b_nongov",
    label: "457(b) Non-Governmental",
    optionLabel: "457(b) Non-governmental — Tax-exempt employer (top hat)",
    headline: "457(b) Non-Governmental — unfunded top-hat plan",
    summary:
      "457(b) Non-Governmental: Amounts deferred remain subject to the employer's general " +
      "creditors until distributed. Distributions restricted to separation from service, " +
      "age 70.5, unforeseeable emergency, or death/disability. No in-service withdrawals at 59.5.",
    notes: [
      "Eligibility must be limited to a select group of management or highly compensated employees — a funded or broadly offered plan loses its treatment.",
      "No trust may be established for participants' benefit; assets stay on the employer's balance sheet.",
      "No designated Roth account and no age-50 catch-up — only the final-three-years catch-up is available.",
      "Amounts cannot be rolled over to an IRA or a 401(k)/403(b); only to another non-governmental 457(b).",
    ],
    electiveDeferrals: true,
    rothAvailable: false,
    employerMatch: true,
    employerNonelective: true,
    safeHarborAvailable: false,
    adpAcpTesting: false,
    availableCatchUps: ["final3"],
    combinedEmployeeEmployerLimit: true,
    universalAvailability: false,
    ageServiceConditionsOnDeferrals: true,
    topHatOnly: true,
    autoEnrollmentAvailable: false,
    erisaVestingFloors: false,
    loansAvailable: false,
    hardshipAvailable: false,
    unforeseeableEmergency: true,
    inServiceAt59_5: false,
    earlyWithdrawalPenalty: false,
    fundingVehicle: "unfunded",
    requiresTrustee: false,
    erisa404cAvailable: false,
    files5500: false,
  },

  "401a": {
    key: "401a",
    label: "401(a)",
    optionLabel: "401(a) — Money purchase / profit sharing (employer-funded)",
    headline: "401(a) — employer-funded qualified plan",
    summary:
      "401(a) plans are funded entirely by the employer — there is no employee elective deferral " +
      "feature, so no Section 402(g) limit applies. Contributions are subject to the Section 415(c) annual " +
      "additions limit and the Section 401(a)(17) compensation cap. A money purchase plan commits the " +
      "employer to a fixed annual contribution and is subject to the minimum funding rules.",
    notes: [
      "A money purchase plan cannot use the profit-sharing exception to the QJSA rules — joint and survivor annuity and spousal consent apply.",
      "Employee contributions, where permitted, are mandatory and after-tax rather than elective deferrals.",
    ],
    electiveDeferrals: false,
    rothAvailable: false,
    employerMatch: true,
    employerNonelective: true,
    safeHarborAvailable: false,
    adpAcpTesting: false,
    availableCatchUps: [],
    combinedEmployeeEmployerLimit: false,
    universalAvailability: false,
    ageServiceConditionsOnDeferrals: true,
    topHatOnly: false,
    autoEnrollmentAvailable: false,
    erisaVestingFloors: true,
    loansAvailable: true,
    hardshipAvailable: false,
    unforeseeableEmergency: false,
    inServiceAt59_5: true,
    earlyWithdrawalPenalty: true,
    fundingVehicle: "trust",
    requiresTrustee: true,
    erisa404cAvailable: true,
    files5500: true,
  },
};

/** Never throws — an unknown or absent plan type falls back to 401(k). */
export function planProfile(planType: string | undefined | null): PlanProfile {
  return PLAN_PROFILES[(planType ?? "401k") as PlanType] ?? PLAN_PROFILES["401k"];
}

export const FUNDING_VEHICLE_LABEL: Record<FundingVehicle, string> = {
  trust: "Trust",
  trust_required: "Trust (required under Section 457(g))",
  custodial_annuity: "Custodial account or annuity contract",
  unfunded: "Unfunded — employer general assets",
};

export const CATCH_UP_LABEL: Record<CatchUpKind, string> = {
  age50: "Age 50+ catch-up",
  super60to63: "Age 60–63 super catch-up",
  service15: "15-year service catch-up",
  final3: "Final three years before normal retirement age",
};
