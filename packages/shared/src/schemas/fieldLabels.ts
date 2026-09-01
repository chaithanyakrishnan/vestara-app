/**
 * Human labels for every schema field and step key.
 *
 * This lives in the shared package rather than the web app because the SERVER
 * writes user-facing text too: `validateReadyToSubmit` used to reject a submit
 * with "Cannot submit — incomplete steps: trustees_funds (namedFiduciary,
 * fidelityBondAmount)", which is a sentence written in variable names. Both
 * sides now read from here, so a field cannot be named one way on screen and
 * another way in an error.
 *
 * Anything missing falls back to `humanizeFieldName`, so a newly added field
 * degrades to "Some New Field" rather than leaking `someNewField`.
 */

export const STEP_LABELS: Record<string, string> = {
  identity: "Company & Plan",
  contributions: "Contributions",
  eligibility: "Eligibility & Entry",
  vesting: "Vesting",
  administration: "Administration",
  trustees_funds: "Trustees & Funds",
};

export const FIELD_LABELS: Record<string, string> = {
  // ---- identity ----
  planType: "Plan Type", employerEin: "Employer EIN", employerName: "Legal Employer Name",
  employerAddress: "Employer Address", employerPhone: "Employer Phone",
  planName: "Plan Name", planNumber: "Plan Number",
  planYearEnd: "Plan Year End", trustName: "Trust Name", planStatus: "Plan Status",
  originalEffectiveDate: "Original Effective Date",
  restatedEffectiveDate: "Restated Effective Date", transferEffectiveDate: "Transfer Effective Date",
  previousRecordkeeper: "Previous Recordkeeper", previousRecordkeeperContact: "Prior Contact Name",
  previousRecordkeeperPhone: "Prior Contact Phone", previousRecordkeeperEmail: "Prior Contact Email",
  approxAssetsTransferring: "Approx. Assets Transferring", payrollProvider: "Payroll Provider",
  erisaStatus: "ERISA Status", organizationType: "Organization Type",
  governmentalEntityType: "Governmental Entity Type",
  topHatCertified: "Top-Hat Certification", planSubtype: "Plan Subtype",

  // ---- contributions ----
  pretaxDeferrals: "Pre-Tax Deferrals", rothDeferrals: "Roth Deferrals",
  catchupPermitted: "Catch-Up Deferrals", catchupMatched: "Catch-Up Matched",
  superCatchupPermitted: "Age 60–63 Super Catch-Up",
  service15CatchupPermitted: "15-Year Service Catch-Up",
  final3CatchupPermitted: "Final Three Years Catch-Up",
  safeHarborElected: "Safe Harbor Elected", safeHarborType: "Safe Harbor Formula",
  safeHarborPeriod: "Safe Harbor Period", safeHarborAppliesTo: "Safe Harbor Applies To",
  safeHarborMatchTier1Pct: "Safe Harbor Tier 1 Match Rate",
  safeHarborMatchTier1UpToPct: "Safe Harbor Tier 1 Deferral Cap",
  safeHarborMatchTier2Pct: "Safe Harbor Tier 2 Match Rate",
  safeHarborMatchTier2UpToPct: "Safe Harbor Tier 2 Deferral Cap",
  safeHarborNonelectivePct: "Safe Harbor Non-Elective Rate",
  matchElected: "Employer Match Elected", matchType: "Match Type", matchPct: "Match Rate",
  matchCapPct: "Match Cap", nonelectiveElected: "Non-Elective Elected",
  nonelectiveType: "Non-Elective Type", nonelectivePct: "Non-Elective Percentage",
  nonelectiveAllocation: "Allocation Method", nonelectiveCondition: "Allocation Condition",
  forfeitureUse: "Forfeiture Use",
  compensationDefinition: "Definition of Compensation",
  compensationExclusions: "Compensation Exclusions",
  compensationPostSeverance: "Post-Severance Compensation",
  adpTestMethod: "ADP / ACP Testing Method",
  topHeavyMinimumBy: "Top-Heavy Minimum Contribution",

  // ---- eligibility ----
  minimumAge: "Minimum Age", serviceRequirement: "Service Requirement",
  deferralServiceRequirement: "Service Requirement for Deferrals",
  entryDates: "Entry Dates",
  hoursOfServiceMethod: "Hours of Service Method", excludeUnion: "Exclude Union Employees",
  excludeNonResidentAliens: "Exclude Non-Resident Aliens", excludePartTime: "Exclude Part-Time",
  excludeHce: "Exclude Highly Compensated Employees",
  ltptTrackingAcknowledged: "Long-Term Part-Time Tracking",
  uaExclusions: "Permitted Exclusions",
  eligibleClassDescription: "Eligible Class",
  autoEnrollElected: "Automatic Enrollment",
  autoEnrollType: "Auto-Enroll Type", autoEnrollDefaultPct: "Default Deferral Percentage",
  autoEnrollEscalation: "Annual Escalation", autoEnrollEscalationCap: "Escalation Cap",
  eacaPermissibleWithdrawal: "90-Day Permissible Withdrawal",

  // ---- vesting ----
  scheduleType: "Vesting Schedule", customSchedule: "Ladder by Year",
  matchVesting: "Vesting on Matching Contributions",
  nonelectiveVesting: "Vesting on Non-Elective Contributions",
  safeHarborVesting: "Vesting on Safe Harbor Contributions",
  substantialRiskOfForfeiture: "Substantial Risk of Forfeiture",
  normalRetirementAge: "Normal Retirement Age",
  vestingOnDeathDisability: "Vesting on Death or Disability",

  // ---- administration ----
  loansPermitted: "Loans Permitted", loanMinAmount: "Minimum Loan Amount",
  loanMaxOutstanding: "Maximum Loans Outstanding", loanMaxBasis: "Maximum Loan Amount",
  loanGeneralMaxTermYears: "General-Purpose Loan Term",
  loanInterestRate: "Loan Interest Rate",
  loanPurpose: "Loan Purpose", loanHomeMaxTermYears: "Home Loan Maximum Term",
  loanRefinancing: "Loan Refinancing", loanAcceleration: "Loan Acceleration",
  loanPaymentsOnLeave: "Loan Payments on Leave",
  inServiceAt59_5: "Age 59½ In-Service Withdrawals",
  inServiceFromRollover: "In-Service From Rollover Account",
  hardshipElected: "Hardship Distributions", hardshipType: "Hardship Type",
  hardshipSelfCertification: "Hardship Self-Certification",
  unforeseeableEmergencyElected: "Unforeseeable Emergency Distributions",
  emergencyExpenseWithdrawal: "Emergency Personal Expense Withdrawal",
  domesticAbuseWithdrawal: "Domestic Abuse Victim Distribution",
  birthAdoptionWithdrawal: "Birth or Adoption Distribution",
  qualifiedDisasterWithdrawal: "Qualified Disaster Distribution",
  inPlanRothConversion: "In-Plan Roth Conversion",
  requiredBeginningAge: "Required Beginning Age",
  rolloversAccepted: "Rollovers Accepted", rolloverSources: "Rollover Sources",
  planExpensePayer: "Plan Expenses Paid By", employerPaymentMethod: "Employer Payment Method",
  employerPaymentBankName: "Bank", employerPaymentAccountType: "Account Type",
  employerPaymentRoutingNumber: "Routing Number", employerPaymentAccountNumber: "Account Number",

  // ---- trustees & funds ----
  trustees: "Trustees", trusteeType: "Trustee Type",
  custodianName: "Custodian or Annuity Issuer",
  investmentProviders: "Investment Providers",
  selectedFundTickers: "Investment Options", qdia: "Default Investment (QDIA)",
  claims404c: "ERISA Section 404(c) Election",
  planAdministratorName: "Plan Administrator",
  planAdministratorIsEmployer: "Employer Serves as Plan Administrator",
  namedFiduciary: "Named Fiduciary",
  agentForServiceOfProcess: "Agent for Service of Legal Process",
  fidelityBondCarrier: "Fidelity Bond Carrier", fidelityBondAmount: "Fidelity Bond Amount",
};

/**
 * Last resort for a field with no entry above: `employerPaymentBankName` reads
 * as "Employer Payment Bank Name" rather than being shown to a plan sponsor as
 * a variable name.
 */
export function humanizeFieldName(field: string): string {
  const spaced = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? humanizeFieldName(field);
}

export function stepLabel(stepKey: string): string {
  return STEP_LABELS[stepKey] ?? humanizeFieldName(stepKey);
}
