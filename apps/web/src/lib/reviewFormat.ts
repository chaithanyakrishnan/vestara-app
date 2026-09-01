import { STEP_REGISTRY, type StepKey } from "@vestara/shared";
import { fundByTicker } from "../data/funds";

/**
 * Turns raw step payloads into the prototype's key/value review rows.
 *
 * Deliberately label-driven rather than reflective: the review screen is the
 * last thing a sponsor reads before e-signing, so every row is a phrase a plan
 * sponsor would recognise, not a camelCase field name with a raw enum value.
 * A field with no entry here simply doesn't render — adding a schema field
 * means adding its label here too.
 */

type Row = [label: string, value: string];
type Dict = Record<string, string>;

const EM_DASH = "—";

const LOOKUPS: Record<string, Dict> = {
  planType: {
    "401k": "401(k) — Private / for-profit employer",
    "403b": "403(b) — Non-profit / public school / hospital",
    "457b_gov": "457(b) Governmental",
    "457b_nongov": "457(b) Non-governmental",
    "401a": "401(a) — Defined contribution / profit sharing",
  },
  planStatus: { new: "New Plan", transfer: "Transfer from another recordkeeper" },
  safeHarborType: {
    basic: "Basic Match (100% to 3% + 50% on 3%–5%)",
    enhanced: "Enhanced Match",
    ne: "Nonelective 3%",
    qaca: "QACA Basic Match",
  },
  safeHarborPeriod: { payroll: "Each payroll period", monthly: "Each month", annual: "Plan year (true-up)" },
  contributionType: { disc: "Discretionary", fixed: "Fixed percentage" },
  nonelectiveAllocation: {
    prorata: "Pro rata (uniform % of comp)",
    integrated: "Integrated with Social Security",
    grouped: "Cross-testing / classifications",
  },
  nonelectiveCondition: {
    lastday: "Last day of plan year",
    "1000hrs": "1,000 hours + employment",
    none: "No condition",
  },
  forfeitureUse: {
    reduce_ne: "Reduce nonelective contributions",
    reduce_match: "Reduce matching contributions",
    pay_expenses: "Pay plan expenses",
    reallocate: "Reallocate to participants",
  },
  minimumAge: { none: "No minimum age", "18": "Age 18", "20.5": "Age 20½", "21": "Age 21" },
  serviceRequirement: {
    none: "Immediate",
    "3mo": "3 months",
    "6mo": "6 months",
    "1yr": "1 Year of Service (1,000 hours)",
    "2yr": "2 Years",
  },
  entryDates: {
    immediate: "Immediate upon eligibility",
    monthly: "First of each month",
    quarterly: "Quarterly",
    semi: "Semi-annual (Jan 1 & Jul 1)",
    annual: "Annual (first day of plan year)",
  },
  hoursOfServiceMethod: { actual: "Actual hours", elapsed: "Elapsed time", split: "Split actual / equivalency" },
  autoEnrollType: { basic: "ACA — basic", eaca: "EACA — eligible", qaca: "QACA — qualified" },
  autoEnrollEscalation: { none: "No escalation", "1pct_yr": "+1% per year", "2pct_yr": "+2% per year" },
  scheduleType: {
    imm: "Immediate",
    "3cliff": "3-Year Cliff",
    "6graded": "6-Year Graded",
    custom: "Custom Schedule",
  },
  normalRetirementAge: { "60": "Age 60", "62": "Age 62", "65": "Age 65", sscra: "Social Security retirement age" },
  vestingOnDeathDisability: {
    both: "Both death and disability",
    death: "Death only",
    disability: "Disability only",
    none: "Neither — schedule applies",
  },
  loanMaxOutstanding: { "1": "1 loan at a time", "2": "2 loans", unlimited: "Unlimited" },
  loanInterestRate: { prime: "Prime", prime1: "Prime + 1%", prime2: "Prime + 2%" },
  loanPurpose: { any: "Any reasonable purpose", hardship_only: "Restricted purposes only" },
  loanRefinancing: { allowed: "Permitted", not_allowed: "Not permitted" },
  loanAcceleration: { on_termination: "On severance or plan termination", never: "No acceleration" },
  loanPaymentsOnLeave: { suspend: "Suspended during leave", continue: "Continue during leave" },
  hardshipType: { safe: "Safe Harbor Hardship", non: "Non-Safe Harbor" },
  rolloverSources: { all: "All eligible retirement plans", qualified_only: "Qualified plans only", none: "None" },
  planExpensePayer: { plan: "Plan assets", employer: "Employer" },
  employerPaymentMethod: { ach: "ACH — automatic bank draft", check: "Check", wire: "Wire transfer" },
  employerPaymentAccountType: { checking: "Checking", savings: "Savings" },
  trusteeType: { disc: "Discretionary Trustee", dir: "Directed (Non-Discretionary)" },
  qdia: { target: "Target-Date Fund Suite", balanced: "Balanced / Lifecycle Fund", managed: "Managed Account" },
};

const look = (dict: string, v: unknown) =>
  v === undefined || v === null || v === "" ? EM_DASH : (LOOKUPS[dict]?.[String(v)] ?? String(v));

const text = (v: unknown) => (v === undefined || v === null || v === "" ? EM_DASH : String(v));
const yesNo = (v: unknown) => (v ? "Yes" : "No");
const pct = (v: unknown) => (v === undefined || v === null || v === "" ? EM_DASH : `${v}%`);
const money = (v: unknown) =>
  v === undefined || v === null || v === "" ? EM_DASH : `$${Number(v).toLocaleString("en-US")}`;
/** Bank credentials are never shown in full on the review screen. */
const masked = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return s ? `•••• ${s.slice(-4)}` : EM_DASH;
};

function identityRows(d: any): Row[] {
  const rows: Row[] = [
    ["Plan Type", look("planType", d.planType)],
    ["Employer EIN", text(d.employerEin)],
    ["Legal Employer Name", text(d.employerName)],
    ["Employer Address", text(d.employerAddress)],
    ["Employer Phone", text(d.employerPhone)],
    ["Plan Name", text(d.planName)],
    ["Plan Number", text(d.planNumber)],
    ["Trust Name", text(d.trustName || (d.planName ? `${d.planName} Trust` : ""))],
    ["Plan Year End", text(d.planYearEnd)],
    ["Plan Status", look("planStatus", d.planStatus)],
    ["Original Effective Date", text(d.originalEffectiveDate)],
  ];
  if (d.restatedEffectiveDate) {
    rows.push(["Restated Effective Date", text(d.restatedEffectiveDate)]);
  }
  if (d.planStatus === "transfer") {
    rows.push(
      ["Transfer Effective Date", text(d.transferEffectiveDate)],
      ["Previous Recordkeeper", text(d.previousRecordkeeper)],
      ["Prior Contact", `${text(d.previousRecordkeeperContact)} · ${text(d.previousRecordkeeperPhone)}`],
      ["Prior Contact Email", text(d.previousRecordkeeperEmail)],
      ["Approx. Assets Transferring", money(d.approxAssetsTransferring)],
    );
  }
  rows.push(["Payroll Provider", text(d.payrollProvider)]);
  return rows;
}

function contributionsRows(d: any): Row[] {
  return [
    ["Pre-Tax Deferrals", yesNo(d.pretaxDeferrals)],
    ["Roth Deferrals", yesNo(d.rothDeferrals)],
    ["Catch-Up Deferrals", d.catchupPermitted === "yes" ? "Permitted" : "Not permitted"],
    ["Catch-Up Matched", d.catchupMatched === "yes" ? "Yes" : "No"],
    ["Safe Harbor", d.safeHarborElected ? look("safeHarborType", d.safeHarborType) : "Not elected"],
    ["Safe Harbor Period", d.safeHarborElected ? look("safeHarborPeriod", d.safeHarborPeriod) : "N/A"],
    ["Safe Harbor Applies To", d.safeHarborElected ? text(d.safeHarborAppliesTo) : "N/A"],
    [
      "Employer Match",
      d.matchElected
        ? d.matchType === "fixed"
          ? `${pct(d.matchPct)} up to ${pct(d.matchCapPct)} of comp`
          : "Discretionary"
        : "Not elected",
    ],
    [
      "Nonelective / Profit Sharing",
      d.nonelectiveElected
        ? d.nonelectiveType === "fixed"
          ? `${pct(d.nonelectivePct)} fixed`
          : "Discretionary"
        : "Not elected",
    ],
    ["NE Allocation Method", d.nonelectiveElected ? look("nonelectiveAllocation", d.nonelectiveAllocation) : "N/A"],
    ["NE Allocation Condition", d.nonelectiveElected ? look("nonelectiveCondition", d.nonelectiveCondition) : "N/A"],
    ["Forfeiture Use", look("forfeitureUse", d.forfeitureUse)],
  ];
}

function eligibilityRows(d: any): Row[] {
  const excluded = [
    d.excludeUnion && "Union / CBA",
    d.excludeNonResidentAliens && "Non-resident aliens",
    d.excludePartTime && "Part-time / seasonal",
    d.excludeHce && "HCEs",
  ].filter(Boolean) as string[];

  return [
    ["Minimum Age", look("minimumAge", d.minimumAge)],
    ["Service Requirement", look("serviceRequirement", d.serviceRequirement)],
    ["Entry Dates", look("entryDates", d.entryDates)],
    ["Hours of Service Method", look("hoursOfServiceMethod", d.hoursOfServiceMethod)],
    ["Excluded Classes", excluded.length ? excluded.join(", ") : "None excluded"],
    [
      "Automatic Enrollment",
      d.autoEnrollElected
        ? `${look("autoEnrollType", d.autoEnrollType)} — ${pct(d.autoEnrollDefaultPct)} default`
        : "Not elected",
    ],
    ["Escalation", d.autoEnrollElected ? look("autoEnrollEscalation", d.autoEnrollEscalation) : "N/A"],
    ["Escalation Cap", d.autoEnrollElected ? pct(d.autoEnrollEscalationCap) : "N/A"],
  ];
}

function vestingRows(d: any): Row[] {
  const ladder = Array.isArray(d.customSchedule)
    ? d.customSchedule.map((r: any) => `${r.pct}%`).join(" / ")
    : EM_DASH;
  return [
    ["Vesting Schedule", look("scheduleType", d.scheduleType)],
    ["Ladder by Year", d.scheduleType === "imm" ? "100% immediately" : ladder],
    ["Normal Retirement Age", look("normalRetirementAge", d.normalRetirementAge)],
    ["100% Vesting on Death / Disability", look("vestingOnDeathDisability", d.vestingOnDeathDisability)],
  ];
}

function administrationRows(d: any): Row[] {
  const rows: Row[] = [
    [
      "Participant Loans",
      d.loansPermitted
        ? `Permitted — ${look("loanInterestRate", d.loanInterestRate)}, min ${money(d.loanMinAmount)}`
        : "Not permitted",
    ],
  ];
  if (d.loansPermitted) {
    rows.push(
      ["Max Loans Outstanding", look("loanMaxOutstanding", d.loanMaxOutstanding)],
      ["Loan Purpose", look("loanPurpose", d.loanPurpose)],
      ["Home Loan Max Term", d.loanHomeMaxTermYears ? `${d.loanHomeMaxTermYears} years` : EM_DASH],
      ["Refinancing", look("loanRefinancing", d.loanRefinancing)],
      ["Loan Acceleration", look("loanAcceleration", d.loanAcceleration)],
      ["Payments on Leave", look("loanPaymentsOnLeave", d.loanPaymentsOnLeave)],
    );
  }
  rows.push(
    ["Age 59½ In-Service Withdrawals", d.inServiceAt59_5 ? "Permitted" : "Not elected"],
    ["Hardship Distributions", d.hardshipElected ? look("hardshipType", d.hardshipType) : "Not elected"],
    ["Rollover Contributions", d.rolloversAccepted ? look("rolloverSources", d.rolloverSources) : "Not accepted"],
    ["Plan Expenses Paid By", look("planExpensePayer", d.planExpensePayer)],
  );
  if (d.planExpensePayer === "employer") {
    rows.push(
      ["Employer Payment Method", look("employerPaymentMethod", d.employerPaymentMethod)],
      ["Bank", text(d.employerPaymentBankName)],
      ["Account Type", look("employerPaymentAccountType", d.employerPaymentAccountType)],
      ["Routing Number", masked(d.employerPaymentRoutingNumber)],
      ["Account Number", masked(d.employerPaymentAccountNumber)],
    );
  }
  return rows;
}

function trusteesFundsRows(d: any): Row[] {
  const tickers: string[] = Array.isArray(d.selectedFundTickers) ? d.selectedFundTickers : [];
  return [
    [
      "Trustees",
      Array.isArray(d.trustees) && d.trustees.length
        ? d.trustees.map((t: any) => `${t.name} (${t.type})`).join(", ")
        : "Not yet added",
    ],
    ["Trustee Type", look("trusteeType", d.trusteeType)],
    [
      "Core Funds",
      tickers.length
        ? tickers.map((t) => `${t} — ${fundByTicker(t)?.name ?? "Unknown fund"}`).join("; ")
        : EM_DASH,
    ],
    ["QDIA", look("qdia", d.qdia)],
  ];
}

const BUILDERS: Record<StepKey, (d: any) => Row[]> = {
  identity: identityRows,
  contributions: contributionsRows,
  eligibility: eligibilityRows,
  vesting: vestingRows,
  administration: administrationRows,
  trustees_funds: trusteesFundsRows,
};

export function buildReviewSection(stepKey: StepKey, data: unknown): Row[] {
  if (!data || typeof data !== "object") return [];
  return BUILDERS[stepKey](data);
}

/**
 * Human labels per schema field, for the extraction review screen — which
 * renders one row per *field* (so each can carry its own confidence score),
 * unlike the sign-off review above which composes fields into sentences.
 */
const FIELD_LABELS: Record<string, string> = {
  planType: "Plan Type", employerEin: "Employer EIN", employerName: "Legal Employer Name",
  employerAddress: "Employer Address", employerPhone: "Employer Phone", planName: "Plan Name", planNumber: "Plan Number",
  planYearEnd: "Plan Year End", trustName: "Trust Name", planStatus: "Plan Status",
  originalEffectiveDate: "Original Effective Date",
  restatedEffectiveDate: "Restated Effective Date", transferEffectiveDate: "Transfer Effective Date",
  previousRecordkeeper: "Previous Recordkeeper", previousRecordkeeperContact: "Prior Contact Name",
  previousRecordkeeperPhone: "Prior Contact Phone", previousRecordkeeperEmail: "Prior Contact Email",
  approxAssetsTransferring: "Approx. Assets Transferring", payrollProvider: "Payroll Provider",

  pretaxDeferrals: "Pre-Tax Deferrals", rothDeferrals: "Roth Deferrals",
  catchupPermitted: "Catch-Up Deferrals", catchupMatched: "Catch-Up Matched",
  safeHarborElected: "Safe Harbor Elected", safeHarborType: "Safe Harbor Formula",
  safeHarborPeriod: "Safe Harbor Period", safeHarborAppliesTo: "Safe Harbor Applies To",
  matchElected: "Employer Match Elected", matchType: "Match Type", matchPct: "Match Rate",
  matchCapPct: "Match Cap", nonelectiveElected: "Nonelective Elected",
  nonelectiveType: "Nonelective Type", nonelectivePct: "Nonelective Percentage",
  nonelectiveAllocation: "Allocation Method", nonelectiveCondition: "Allocation Condition",
  forfeitureUse: "Forfeiture Use",

  minimumAge: "Minimum Age", serviceRequirement: "Service Requirement", entryDates: "Entry Dates",
  hoursOfServiceMethod: "Hours of Service Method", excludeUnion: "Exclude Union Employees",
  excludeNonResidentAliens: "Exclude Non-Resident Aliens", excludePartTime: "Exclude Part-Time",
  excludeHce: "Exclude HCEs", autoEnrollElected: "Automatic Enrollment",
  autoEnrollType: "Auto-Enroll Type", autoEnrollDefaultPct: "Default Deferral %",
  autoEnrollEscalation: "Annual Escalation", autoEnrollEscalationCap: "Escalation Cap",

  scheduleType: "Vesting Schedule", customSchedule: "Ladder by Year",
  normalRetirementAge: "Normal Retirement Age", vestingOnDeathDisability: "Vesting on Death/Disability",

  loansPermitted: "Loans Permitted", loanMinAmount: "Minimum Loan Amount",
  loanMaxOutstanding: "Max Loans Outstanding", loanInterestRate: "Loan Interest Rate",
  loanPurpose: "Loan Purpose", loanHomeMaxTermYears: "Home Loan Max Term",
  loanRefinancing: "Refinancing", loanAcceleration: "Loan Acceleration",
  loanPaymentsOnLeave: "Payments on Leave", inServiceAt59_5: "Age 59½ In-Service Withdrawals",
  hardshipElected: "Hardship Distributions", hardshipType: "Hardship Type",
  rolloversAccepted: "Rollovers Accepted", rolloverSources: "Rollover Sources",
  planExpensePayer: "Plan Expenses Paid By", employerPaymentMethod: "Employer Payment Method",
  employerPaymentBankName: "Bank", employerPaymentAccountType: "Account Type",
  employerPaymentRoutingNumber: "Routing Number", employerPaymentAccountNumber: "Account Number",

  trustees: "Trustees", trusteeType: "Trustee Type",
  selectedFundTickers: "Core Funds", qdia: "QDIA",
};

/** Fields never rendered in full — bank credentials. */
const MASKED_FIELDS = new Set(["employerPaymentRoutingNumber", "employerPaymentAccountNumber"]);

function displayValue(field: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return EM_DASH;
  if (MASKED_FIELDS.has(field)) return masked(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (!value.length) return EM_DASH;
    if (field === "customSchedule") return value.map((r: any) => `${r.pct}%`).join(" / ");
    if (field === "trustees") return value.map((t: any) => `${t.name} (${t.type})`).join(", ");
    return value.join(", ");
  }
  // Reuse the enum label tables where the field name matches a lookup.
  if (LOOKUPS[field]) return look(field, value);
  return String(value);
}

export interface FieldEntry {
  field: string;
  label: string;
  value: string;
}

/** One entry per field actually present in a stored step payload. */
export function fieldEntries(data: unknown): FieldEntry[] {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data as Record<string, unknown>)
    .filter(([field]) => field !== "_confidence")
    .map(([field, value]) => ({
      field,
      label: FIELD_LABELS[field] ?? field,
      value: displayValue(field, value),
    }));
}

export function contactRows(contacts: any[] | undefined): Row[] {
  const advisor = contacts?.find((c) => c.type === "advisor");
  const sponsor = contacts?.find((c) => c.type === "sponsor");
  const tpa = contacts?.find((c) => c.type === "tpa");
  const rows: Row[] = [
    ["Financial Advisor", advisor ? `${advisor.name} — ${advisor.org ?? EM_DASH}` : EM_DASH],
    ["Advisor Email / Phone", advisor ? `${text(advisor.email)} · ${text(advisor.phone)}` : EM_DASH],
    ["Plan Sponsor Contact", sponsor ? `${sponsor.name} — ${sponsor.org ?? EM_DASH}` : EM_DASH],
    ["Sponsor Email / Phone", sponsor ? `${text(sponsor.email)} · ${text(sponsor.phone)}` : EM_DASH],
  ];
  // The row exists only when a TPA was elected, so say so either way rather
  // than showing an empty pair of lines — "None engaged" is itself an answer
  // the signer is confirming.
  if (tpa) {
    rows.push(["Third Party Administrator", `${tpa.org ?? EM_DASH}${tpa.name ? ` — ${tpa.name}` : ""}`]);
    rows.push(["TPA Email / Phone", `${text(tpa.email)} · ${text(tpa.phone)}`]);
  } else {
    rows.push(["Third Party Administrator", "None engaged"]);
  }
  return rows;
}

/**
 * The fields a stored step payload still needs before it would validate.
 *
 * Extraction can now write a PARTIAL section — when a document is only partly
 * readable the API keeps every field that validated instead of discarding the
 * whole section (see apps/api extractionRecovery.ts). That is only honest if
 * the review screen names what is still outstanding, so this recomputes it from
 * the same registry schema the API and the wizard forms use.
 */
/** Human label for a schema field name, falling back to the raw name. */
export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function missingFieldLabels(stepKey: StepKey, data: unknown): string[] {
  const step = STEP_REGISTRY.find((s) => s.key === stepKey);
  if (!step || !data) return [];
  const result = step.schema.safeParse(data);
  if (result.success) return [];
  const fields = new Set(
    result.error.issues.map((issue) => String(issue.path[0] ?? "")).filter(Boolean),
  );
  return [...fields].map(fieldLabel);
}

export { STEP_REGISTRY };
