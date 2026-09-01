/**
 * Deterministic fallback used when ANTHROPIC_API_KEY is not configured, so
 * the full upload -> parse -> prefill -> provenance flow is demoable with
 * zero external dependencies. Mirrors the hardcoded 4 Bears Casino dataset
 * from the original prototype so behavior is comparable side-by-side.
 *
 * IMPORTANT: every section here must actually pass its step schema in
 * @vestara/shared. `applyExtractionToPlan` safe-parses each one and silently
 * routes failures into `skippedSections`, so an invalid section reads to the
 * user as "the document wasn't read fully". Three earlier bugs of exactly that
 * kind are fixed here:
 *   - identity declared planStatus "transfer" but omitted previousRecordkeeper,
 *     which IdentityStepSchema's superRefine requires for transfers;
 *   - vesting declared scheduleType "custom" with no customSchedule rows;
 *   - the trustees_funds step was never emitted at all — only a bare `trustees`
 *     array, which writes PlanTrustee rows but leaves the step itself empty.
 * Keep `scripts/verify-mock-extraction.ts` passing when editing this file.
 */
export const MOCK_EXTRACTION = {
  identity: {
    employerName: "4 Bears Casino & Lodge",
    employerEin: "45-0431167",
    employerAddress: "202 Frontage Rd, New Town, ND 58763",
    employerPhone: "(701) 627-4018",
    planName: "4 Bears Casino & Lodge 401(k) Plan",
    planNumber: "001",
    trustName: "4 Bears Casino & Lodge 401(k) Plan Trust",
    planYearEnd: "Dec 31",
    planStatus: "transfer",
    originalEffectiveDate: "03/01/2002",
    restatedEffectiveDate: "02/01/2023",
    transferEffectiveDate: "02/01/2023",
    // Required whenever planStatus is "transfer".
    previousRecordkeeper: "Empower Retirement",
    previousRecordkeeperContact: "Dana Whitcomb",
    previousRecordkeeperPhone: "(701) 627-4018",
    previousRecordkeeperEmail: "dana.whitcomb@empower.com",
    approxAssetsTransferring: 4820000,
    payrollProvider: "ADP",
    planType: "401k",
    _confidence: {
      employerName: 0.99, employerEin: 0.99, employerAddress: 0.94, planName: 0.98,
      planNumber: 0.96, trustName: 0.71, planYearEnd: 0.93, planStatus: 0.88,
      employerPhone: 0.9, restatedEffectiveDate: 0.95, originalEffectiveDate: 0.91, transferEffectiveDate: 0.83,
      previousRecordkeeper: 0.62, previousRecordkeeperContact: 0.48,
      previousRecordkeeperPhone: 0.44, previousRecordkeeperEmail: 0.41,
      approxAssetsTransferring: 0.55, payrollProvider: 0.68, planType: 0.99,
    },
  },
  contributions: {
    pretaxDeferrals: true,
    // A plan permitting catch-up needs a Roth source: SECURE 2.0 Section 603 requires
    // catch-up to be Roth for participants over the indexed wage threshold.
    rothDeferrals: true,
    catchupPermitted: "yes",
    catchupMatched: "yes",
    safeHarborElected: true,
    safeHarborType: "basic",
    safeHarborPeriod: "payroll",
    safeHarborAppliesTo: "All eligible participants",
    // The basic safe harbor formula: 100% on the first 3%, 50% on the next 2%.
    safeHarborMatchTier1Pct: 100,
    safeHarborMatchTier1UpToPct: 3,
    safeHarborMatchTier2Pct: 50,
    safeHarborMatchTier2UpToPct: 5,
    matchElected: false,
    nonelectiveElected: true,
    nonelectiveType: "disc",
    nonelectiveAllocation: "prorata",
    nonelectiveCondition: "lastday",
    forfeitureUse: "reduce_ne",
    compensationDefinition: "w2",
    compensationExclusions: [],
    compensationPostSeverance: "include",
    _confidence: {
      pretaxDeferrals: 0.99, rothDeferrals: 0.95, catchupPermitted: 0.92,
      catchupMatched: 0.74, safeHarborElected: 0.97, safeHarborType: 0.93,
      safeHarborPeriod: 0.86, safeHarborAppliesTo: 0.64, matchElected: 0.9,
      nonelectiveElected: 0.89, nonelectiveType: 0.81,
      nonelectiveAllocation: 0.66, nonelectiveCondition: 0.72, forfeitureUse: 0.85,
      safeHarborMatchTier1Pct: 0.88, safeHarborMatchTier1UpToPct: 0.88,
      safeHarborMatchTier2Pct: 0.84, safeHarborMatchTier2UpToPct: 0.84,
      compensationDefinition: 0.71, compensationPostSeverance: 0.55,
    },
  },
  eligibility: {
    minimumAge: "18",
    serviceRequirement: "1yr",
    entryDates: "semi",
    hoursOfServiceMethod: "split",
    excludeUnion: true,
    excludeNonResidentAliens: true,
    excludePartTime: false,
    excludeHce: false,
    autoEnrollElected: false,
    _confidence: {
      minimumAge: 0.97, serviceRequirement: 0.95, entryDates: 0.9,
      hoursOfServiceMethod: 0.58, excludeUnion: 0.93, excludeNonResidentAliens: 0.91,
      excludePartTime: 0.79, excludeHce: 0.76, autoEnrollElected: 0.94,
    },
  },
  vesting: {
    scheduleType: "custom",
    // 0/20/40/60/80/100 by completed years of service — the prototype's default
    // custom ladder. Satisfies the six-year graded floor in irsVestingFloor.ts.
    customSchedule: [
      { yearLabel: "Less than 1", pct: 0 },
      { yearLabel: "1", pct: 20 },
      { yearLabel: "2", pct: 40 },
      { yearLabel: "3", pct: 60 },
      { yearLabel: "4", pct: 80 },
      { yearLabel: "5+", pct: 100 },
    ],
    normalRetirementAge: "65",
    vestingOnDeathDisability: "both",
    _confidence: {
      scheduleType: 0.88, customSchedule: 0.84,
      normalRetirementAge: 0.96, vestingOnDeathDisability: 0.69,
    },
  },
  administration: {
    loansPermitted: true,
    loanMinAmount: 1000,
    loanMaxOutstanding: "1",
    loanMaxBasis: "statutory",
    loanGeneralMaxTermYears: 5,
    loanInterestRate: "prime1",
    loanPurpose: "any",
    loanHomeMaxTermYears: 10,
    loanRefinancing: "not_allowed",
    loanAcceleration: "on_termination",
    loanPaymentsOnLeave: "suspend",
    inServiceAt59_5: true,
    hardshipElected: true,
    hardshipType: "safe",
    rolloversAccepted: true,
    rolloverSources: "all",
    planExpensePayer: "plan",
    requiredBeginningAge: "73",
    _confidence: {
      loansPermitted: 0.98, loanMinAmount: 0.94, loanMaxOutstanding: 0.87,
      loanInterestRate: 0.9, loanPurpose: 0.73, loanHomeMaxTermYears: 0.68,
      loanRefinancing: 0.61, loanAcceleration: 0.57, loanPaymentsOnLeave: 0.52,
      inServiceAt59_5: 0.95, hardshipElected: 0.96, hardshipType: 0.89,
      rolloversAccepted: 0.93, rolloverSources: 0.7, planExpensePayer: 0.82,
      loanMaxBasis: 0.79, loanGeneralMaxTermYears: 0.83, requiredBeginningAge: 0.6,
    },
  },
  trustees_funds: {
    trustees: [{ name: "Wesley Scott Wilson", type: "Individual" as const }],
    trusteeType: "disc",
    // Three diversified options with materially different risk and return
    // characteristics — the condition for CLAIMING Section 404(c), which the plan does.
    selectedFundTickers: ["VTSAX", "VTIAX", "VBTLX"],
    qdia: "target",
    claims404c: true,
    planAdministratorIsEmployer: true,
    namedFiduciary: "4 Bears Casino & Lodge",
    agentForServiceOfProcess: "",
    fidelityBondCarrier: "",
    fidelityBondAmount: 50000,
    _confidence: {
      trustees: 0.97, trusteeType: 0.65, selectedFundTickers: 0.46, qdia: 0.51,
      claims404c: 0.5, planAdministratorIsEmployer: 0.62, namedFiduciary: 0.58,
      fidelityBondAmount: 0.41,
    },
  },
  /**
   * Duplicated from trustees_funds.trustees on purpose: the normalized
   * PlanTrustee table is populated from this top-level key (it is genuinely
   * relational), while the step payload above is what hydrates the wizard form.
   */
  trustees: [{ name: "Wesley Scott Wilson", type: "Individual" as const }],
};
