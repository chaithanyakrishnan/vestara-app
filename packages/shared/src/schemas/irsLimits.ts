/**
 * Indexed IRS dollar limits, in ONE place.
 *
 * Every screen that quotes a limit derives it from here, so the annual update
 * (IRS issues the new figures each autumn in a Notice) is a single edit to this
 * object rather than a search for hardcoded strings across the wizard.
 *
 * NOTE for whoever does that update: `LIMITS_BANNER` is generated from these
 * values, not typed out separately — change a number and the banner follows.
 *
 * SOURCE: IRS Notice 2025-67 (2026 amounts), cross-checked against the IRS COLA
 * table at irs.gov/retirement-plans/cola-increases-for-dollar-limitations-on-
 * benefits-and-contributions. Cite the notice when you next revise these — a
 * figure carried over from the prior year is the easy mistake here, and two of
 * them were in the first draft of this file.
 */

export const IRS_LIMITS_YEAR = 2026;

export const IRS_LIMITS = {
  /** Section 402(g) elective deferral limit. 2025: $23,500. */
  electiveDeferral: 24_500,
  /** Section 414(v) age-50 catch-up. Not available to non-governmental 457(b) plans. 2025: $7,500. */
  catchUp50: 8_000,
  /** SECURE 2.0 Section 109 higher catch-up for ages 60–63. Unchanged from 2025. */
  superCatchUp60to63: 11_250,
  /** Section 415(c) annual additions limit (all sources combined). 2025: $70,000. */
  section415c: 72_000,
  /** Section 401(a)(17) annual compensation cap. 2025: $350,000. */
  compensationCap: 360_000,
  /** Section 414(q) highly compensated employee threshold (prior-year look-back). Unchanged from 2025. */
  hceThreshold: 160_000,
  /**
   * Section 414(v)(7)(A) wage threshold above which catch-up must be Roth (SECURE 2.0
   * Section 603). Measured on PRIOR-YEAR FICA wages (Form W-2 Box 3) per employer, so
   * the 2026 test uses 2025 wages. Statutory $145,000 for 2023–2025, indexed in
   * $5,000 increments from 2026.
   */
  rothCatchUpWageThreshold: 150_000,
} as const;

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * The limits strip shown above the plan-type selector on step 1.
 * Wording is the product owner's; the figures come from IRS_LIMITS.
 */
export const LIMITS_BANNER =
  `${IRS_LIMITS_YEAR} IRS limits: ` +
  `Deferral Section 402(g): ${usd(IRS_LIMITS.electiveDeferral)} | ` +
  `Age 50+ catch-up: ${usd(IRS_LIMITS.catchUp50)} | ` +
  `Age 60-63 super catch-up: ${usd(IRS_LIMITS.superCatchUp60to63)} | ` +
  `Section 415(c) total: ${usd(IRS_LIMITS.section415c)} | ` +
  `Comp cap: ${usd(IRS_LIMITS.compensationCap)} | ` +
  `HCE threshold: ${usd(IRS_LIMITS.hceThreshold)}`;

/** Individual chips, for rendering the strip as discrete labelled values. */
export const LIMITS_CHIPS: Array<{ label: string; value: string }> = [
  { label: "Deferral Section 402(g)", value: usd(IRS_LIMITS.electiveDeferral) },
  { label: "Age 50+ catch-up", value: usd(IRS_LIMITS.catchUp50) },
  { label: "Age 60–63 super catch-up", value: usd(IRS_LIMITS.superCatchUp60to63) },
  { label: "Section 415(c) total", value: usd(IRS_LIMITS.section415c) },
  { label: "Comp cap", value: usd(IRS_LIMITS.compensationCap) },
  { label: "HCE threshold", value: usd(IRS_LIMITS.hceThreshold) },
];
