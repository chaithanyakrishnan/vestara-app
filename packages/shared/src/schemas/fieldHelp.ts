/**
 * Plain-language explanations of what each plan election actually means.
 *
 * Keyed by schema field name so `FormField` can look one up from the `name` it
 * already receives — adding an entry here puts a tooltip on that field with no
 * change to any step form.
 *
 * Deliberately NOT covered: names, emails, phone numbers, addresses, titles and
 * firm names. Those explain themselves, and a tooltip on every single label
 * teaches people to ignore all of them. Only elections that carry plan-design
 * or compliance consequences get one.
 */
export const FIELD_HELP: Record<string, string> = {
  // ---- parties ----
  fiduciary:
    "A 3(21) adviser recommends investments and shares fiduciary responsibility with the employer. A 3(38) manager is appointed to select and monitor investments and takes on that responsibility directly.",

  // ---- identity ----
  planType:
    "Determines which part of the Internal Revenue Code governs the plan, and therefore which elections are even available — a 401(a) has no employee deferrals, a 403(b) has no trustee, and a non-governmental 457(b) must stay unfunded.",
  employerEin:
    "The employer's nine-digit federal Employer Identification Number. Together with the plan number it is how the IRS and DOL identify this plan on Form 5500.",
  planName:
    "The plan's official legal name as it appears in the plan document. It must be distinct from the employer's own name.",
  planNumber:
    "A three-digit number the employer assigns to distinguish its plans on Form 5500. The first plan is 001, the second 002, and a number is never reused.",
  planYearEnd:
    "The last day of the plan's fiscal year. It sets the deadline for testing, contributions and the Form 5500 filing, and most plans use the calendar year.",
  trustName:
    "The legal name of the trust that holds plan assets. Usually the plan name followed by 'Trust'.",
  planStatus:
    "A new plan starts from nothing. A transfer moves an existing plan from another recordkeeper, which means prior balances, participant history and vesting service all have to come across.",
  originalEffectiveDate:
    "The date the plan first came into existence, even if it has been amended and restated many times since.",
  restatedEffectiveDate:
    "The date this restated version of the document takes effect. On an amendment and restatement, this — not the original date — is the operative one.",
  transferEffectiveDate:
    "The date assets and administration move from the prior recordkeeper to this one.",
  previousRecordkeeper:
    "The provider currently holding the plan's assets and records. Required on a transfer so the conversion can be coordinated with them.",
  approxAssetsTransferring:
    "Roughly how much is moving across. Used to scope the conversion and to size the required fidelity bond.",
  payrollProvider:
    "Who runs payroll. Deferrals are withheld through payroll, so this determines how contribution files will reach the recordkeeper.",
  erisaStatus:
    "Whether the 403(b) is covered by ERISA. A non-ERISA plan files no Form 5500 and has no Section 404(c) relief, but the exemption is lost if the employer contributes or is too involved in administering it.",
  organizationType:
    "The kind of employer sponsoring the 403(b). It determines eligibility for the plan type at all, and whether the 15-year service catch-up is available.",
  governmentalEntityType:
    "The kind of governmental employer. Governmental plans are exempt from ERISA's vesting, testing and reporting rules.",
  topHatCertified:
    "A non-governmental 457(b) is only valid if participation is limited to a select group of management or highly compensated employees. Offering it broadly forfeits the plan's tax treatment.",
  planSubtype:
    "A money purchase plan commits the employer to a fixed contribution every year and is subject to minimum funding rules. A profit sharing plan lets the employer decide each year.",

  // ---- contributions ----
  pretaxDeferrals:
    "Contributions taken from pay before income tax. They reduce taxable income now and are taxed when withdrawn.",
  rothDeferrals:
    "Contributions taken from pay after tax. Qualified withdrawals, including the earnings, come out tax-free.",
  catchupPermitted:
    "An extra amount participants aged 50 and over may contribute above the standard annual deferral limit.",
  catchupMatched:
    "Whether the employer match applies to catch-up contributions as well as regular deferrals.",
  superCatchupPermitted:
    "A higher catch-up limit for participants aged 60 to 63, added by SECURE 2.0. Adopting it is optional but must be written into the document.",
  service15CatchupPermitted:
    "A 403(b)-only catch-up for employees with 15 or more years of service at a school, hospital, church or health and welfare agency.",
  final3CatchupPermitted:
    "A 457(b)-only catch-up available in the three years before normal retirement age. It can roughly double the annual limit, but cannot be combined with the age-50 catch-up in the same year.",
  safeHarborElected:
    "A safe harbor plan automatically passes ADP and ACP nondiscrimination testing, in exchange for a required employer contribution that is immediately vested.",
  safeHarborType:
    "Which statutory formula the employer will fund. Each buys the same testing relief but costs a different amount.",
  safeHarborPeriod:
    "How often the match is calculated. A per-payroll match is funded as pay is earned; an annual calculation requires a year-end true-up.",
  safeHarborAppliesTo:
    "Whether the safe harbor contribution goes to everyone eligible, or only to employees who are not highly compensated.",
  safeHarborMatchTier1Pct:
    "The match rate on the first tier of deferrals. The basic formula matches 100% of the first 3% of pay.",
  safeHarborMatchTier1UpToPct:
    "The share of pay the first-tier rate applies up to.",
  safeHarborMatchTier2Pct:
    "The match rate on the second tier. The basic formula matches 50% of the next 2% of pay.",
  safeHarborMatchTier2UpToPct: "The share of pay the second-tier rate applies up to.",
  safeHarborNonelectivePct:
    "A contribution made to every eligible employee whether or not they defer. The statutory minimum is 3% of pay.",
  matchElected:
    "An employer contribution made only for employees who contribute themselves. Separate from any safe harbor match.",
  matchType:
    "A fixed match is written into the document and must be funded every year. A discretionary match is decided annually by the employer.",
  matchPct: "The percentage of an employee's deferral the employer contributes.",
  matchCapPct: "The share of pay above which deferrals are no longer matched.",
  nonelectiveElected:
    "An employer contribution made to eligible employees regardless of whether they contribute anything themselves. Often called profit sharing.",
  nonelectiveType:
    "A fixed contribution is promised in the document. A discretionary one is decided each year by the employer.",
  nonelectivePct: "The percentage of pay contributed for each eligible employee.",
  nonelectiveAllocation:
    "How the contribution is divided. Pro-rata gives everyone the same percentage of pay; integrated gives more above the Social Security wage base; grouped allocates by defined employee classes and requires annual testing.",
  nonelectiveCondition:
    "What an employee must do to share in the contribution — be employed on the last day of the year, work 1,000 hours, or neither.",
  forfeitureUse:
    "What happens to unvested employer money left behind when someone leaves. SECURE 2.0 requires forfeitures to be used within twelve months.",
  compensationDefinition:
    "Which definition of pay every contribution is calculated on. Using the wrong one is the single most common operational error corrected under the IRS's EPCRS programme.",
  compensationExclusions:
    "Categories of pay left out of the plan's definition. Each exclusion narrows the base for every contribution, and can require Section 414(s) testing to show the definition is still nondiscriminatory.",
  compensationPostSeverance:
    "Whether pay received shortly after someone leaves — final regular pay, unused leave — counts as plan compensation.",
  adpTestMethod:
    "Prior-year testing uses last year's employee results, so the limit for highly compensated employees is known in advance. Current-year testing is more flexible but the result is only known after year end.",
  topHeavyMinimumBy:
    "If more than 60% of plan assets belong to key employees, the plan is top-heavy and the employer must make a minimum contribution for everyone else.",

  // ---- eligibility ----
  minimumAge:
    "The youngest age at which an employee can join. The law does not allow a plan to require more than age 21.",
  serviceRequirement:
    "How long an employee must work before joining. Two years is only allowed for employer contributions, and only if they vest immediately.",
  deferralServiceRequirement:
    "How long an employee must work before they may contribute from their own pay. This can never exceed one year.",
  entryDates:
    "When an employee who has met the requirements actually joins. The law caps the wait at the earlier of the next plan year or six months.",
  hoursOfServiceMethod:
    "How service is counted. Actual hours are tracked from payroll records; elapsed time simply counts time employed, regardless of hours worked.",
  excludeUnion:
    "Employees covered by a collective bargaining agreement where retirement benefits were negotiated may be excluded.",
  excludeNonResidentAliens:
    "Non-resident aliens with no earned income from US sources may be excluded.",
  excludePartTime:
    "Part-time employees may be excluded from employer contributions, but not from contributing their own pay once they reach the long-term part-time threshold.",
  excludeHce:
    "Highly compensated employees may be excluded. Unusual, but it can help the plan pass nondiscrimination testing.",
  ltptTrackingAcknowledged:
    "SECURE 2.0 requires that employees with two consecutive years of 500 or more hours be allowed to contribute, even if part-time employees are otherwise excluded. The plan has to track their hours to identify them.",
  uaExclusions:
    "The only groups a 403(b) may leave out of the chance to contribute. Applying an exclusion to one employee means applying it to everyone in that class.",
  eligibleClassDescription:
    "The management or highly compensated group permitted to participate. This is what keeps a non-governmental 457(b) valid, so it should be specific.",
  autoEnrollElected:
    "Employees are enrolled at a default rate unless they opt out. Most plans established after 2022 are now required to do this.",
  autoEnrollType:
    "A basic arrangement simply enrols people. An EACA adds a uniform notice and a 90-day withdrawal window. A QACA also satisfies nondiscrimination testing, in exchange for required employer contributions.",
  autoEnrollDefaultPct:
    "The percentage of pay withheld for employees who never make an election of their own.",
  autoEnrollEscalation:
    "How much the default rate rises each year, so contributions keep pace without the employee acting.",
  autoEnrollEscalationCap: "The rate at which automatic increases stop.",
  eacaPermissibleWithdrawal:
    "Lets an automatically enrolled employee take back their contributions within 90 days of the first deduction, without the usual early withdrawal penalty.",

  // ---- vesting ----
  scheduleType:
    "How long employees must work before employer contributions become theirs to keep. Their own contributions are always fully vested immediately.",
  customSchedule:
    "A year-by-year ladder of your own. It must be at least as generous as the six-year graded or three-year cliff minimum, and can never decrease.",
  matchVesting: "The schedule that applies specifically to matching contributions.",
  nonelectiveVesting:
    "The schedule that applies specifically to profit sharing or other non-elective contributions.",
  safeHarborVesting:
    "Safe harbor contributions must vest immediately. The one exception is QACA money, which may use a two-year cliff.",
  substantialRiskOfForfeiture:
    "The condition, if any, an employee must still satisfy to keep deferred amounts. Until it lapses, the amounts are not yet taxable to them.",
  normalRetirementAge:
    "The age at which participants become fully vested automatically and may retire with full benefits. It cannot be later than 65.",
  vestingOnDeathDisability:
    "Whether employees become fully vested regardless of service if they die or become disabled while employed.",

  // ---- administration ----
  loansPermitted:
    "Whether participants may borrow from their own account balance and repay it with interest through payroll.",
  loanMinAmount: "The smallest loan the plan will issue, which keeps administrative cost proportionate.",
  loanMaxOutstanding: "How many loans a participant may have running at the same time.",
  loanMaxBasis:
    "The statutory ceiling is the lesser of $50,000 or half the vested balance. A plan may set a lower limit but never a higher one.",
  loanGeneralMaxTermYears:
    "How long a participant has to repay an ordinary loan. The law caps this at five years.",
  loanInterestRate:
    "The rate charged, usually the prime rate plus a margin. Interest is paid back into the participant's own account.",
  loanPurpose:
    "Whether loans may be taken for any reason, or only to buy a principal residence.",
  loanHomeMaxTermYears:
    "A loan used to buy a principal residence may be repaid over longer than the usual five years.",
  loanRefinancing: "Whether a participant may replace an existing loan with a new, larger one.",
  loanAcceleration:
    "Whether the outstanding balance becomes immediately due when someone leaves, or repayment may continue.",
  loanPaymentsOnLeave:
    "Whether repayments pause during an approved leave of absence. Military leave has its own protections.",
  inServiceAt59_5:
    "Lets participants aged 59½ or older withdraw from their account while still employed, without the early withdrawal penalty.",
  inServiceFromRollover:
    "Money rolled in from a previous employer's plan can be made available at any age, since it was already the participant's.",
  hardshipElected:
    "Withdrawals for an immediate and heavy financial need — medical bills, avoiding eviction, funeral costs, certain education and home purchase expenses.",
  hardshipType:
    "Safe harbor uses the IRS's defined list of qualifying events. Non-safe-harbor allows broader reasons but requires the employer to review each case.",
  hardshipSelfCertification:
    "SECURE 2.0 lets the plan accept the employee's own written statement of need rather than collecting supporting documents.",
  unforeseeableEmergencyElected:
    "The 457(b) equivalent of hardship, and a stricter standard: the need must be unforeseeable and not relievable by insurance, selling assets, or stopping contributions.",
  emergencyExpenseWithdrawal:
    "A withdrawal of up to $1,000 a year for an unexpected personal or family emergency, without the early withdrawal penalty.",
  domesticAbuseWithdrawal:
    "A penalty-free withdrawal for a participant who self-certifies they have experienced domestic abuse.",
  birthAdoptionWithdrawal:
    "A penalty-free withdrawal within a year of a birth or adoption, which may be repaid to the plan later.",
  qualifiedDisasterWithdrawal:
    "A penalty-free withdrawal for participants affected by a federally declared disaster.",
  inPlanRothConversion:
    "Lets participants move money from their pre-tax account into their Roth account, paying the tax now so future qualified withdrawals are tax-free.",
  requiredBeginningAge:
    "The age at which participants must start taking minimum distributions. SECURE 2.0 raised it to 73, rising to 75 in 2033.",
  rolloversAccepted:
    "Whether the plan will take in money from a previous employer's plan or an IRA, letting employees consolidate their savings.",
  rolloverSources: "Which kinds of retirement accounts the plan will accept money from.",
  planExpensePayer:
    "Whether administrative fees come out of plan assets, reducing participant balances, or are paid by the employer.",
  employerPaymentMethod: "How the employer will settle plan invoices when it pays the fees itself.",
  employerPaymentAccountType: "Whether the account being drafted is a checking or savings account.",

  // ---- trustees & funds ----
  trustees:
    "The people or institution that legally hold plan assets and are named in the trust agreement. Trustees are fiduciaries.",
  trusteeType:
    "A discretionary trustee decides how assets are invested. A directed trustee acts only on instructions from the employer or participants.",
  custodianName:
    "A 403(b) has no trustee. Assets sit in custodial accounts or annuity contracts held by a custodian or insurance company.",
  selectedFundTickers:
    "The investment options participants may choose among. The lineup is a fiduciary decision and has to be monitored over time.",
  qdia:
    "Where contributions go for participants who never make an investment choice. Using a qualified default protects the fiduciary from liability for that allocation.",
  claims404c:
    "Optional relief: if participants genuinely direct their own investments and receive the required disclosures, fiduciaries are not liable for the results of those choices.",
  planAdministratorIsEmployer:
    "The plan administrator is legally responsible for running the plan, filing Form 5500 and providing participant notices. Most employers take this on themselves.",
  planAdministratorName:
    "The party responsible for running the plan day to day. A 3(16) firm can be appointed to take on this role instead of the employer.",
  namedFiduciary:
    "ERISA requires the plan to name at least one fiduciary with authority to control and manage it. Often the employer, a committee, or the board.",
  agentForServiceOfProcess:
    "The person or entity legally served if the plan is sued. Disclosed to participants and reported on Form 5500.",
  fidelityBondCarrier: "The surety company issuing the plan's fidelity bond.",
  fidelityBondAmount:
    "ERISA requires anyone handling plan funds to be bonded for 10% of those funds — at least $1,000 and at most $500,000, or $1,000,000 if the plan holds employer stock. An unbonded plan is a standard audit finding.",
};

/**
 * Explanations for the section HEADINGS, which label a group of choices rather
 * than a single input. Several of the biggest plan concepts — safe harbor,
 * forfeitures, vesting — are named at this level and nowhere else, because the
 * options underneath are rendered as cards rather than form fields.
 *
 * Keyed by the heading text exactly as it appears on screen.
 */
export const SECTION_HELP: Record<string, string> = {
  "Plan Type":
    "The section of the tax code the plan is written under. It decides which elections exist at all — a 401(a) has no employee deferrals, a 403(b) has no trustee, and a non-governmental 457(b) must remain unfunded.",
  "Elective Deferrals":
    "Contributions employees choose to make from their own pay. The annual amount is capped by the Section 402(g) limit shown at the top of this wizard.",
  "Employer Match":
    "Money the employer contributes only for employees who contribute themselves — a direct incentive to participate.",
  "Nonelective / Profit Sharing":
    "Money the employer contributes to eligible employees whether or not they save anything themselves.",
  "Forfeiture Use":
    "Unvested employer money left behind when an employee leaves before fully vesting. SECURE 2.0 requires it to be used within twelve months rather than accumulating.",
  "Nondiscrimination Testing":
    "Annual tests proving the plan does not disproportionately favour highly compensated employees. A safe harbor design passes them automatically.",
  "Service & Age Requirements":
    "How long someone must work, and how old they must be, before they can join. The law caps these at one year of service and age 21.",
  "Excluded Employee Classes":
    "Groups left out of the plan entirely. Every exclusion narrows coverage, and the plan must still pass minimum coverage testing.",
  "Automatic Enrollment":
    "Employees are enrolled at a default rate unless they opt out. Most plans established after 2022 are now required to include it.",
  "Eligible Class":
    "For a non-governmental 457(b), participation must be limited to a select group of management or highly compensated employees, or the plan loses its tax treatment.",
  "Schedule Type":
    "How long employees must work before employer contributions become theirs to keep. Their own contributions are always immediately vested.",
  "Vesting by Contribution Source":
    "Vesting belongs to each kind of money separately. Deferrals, rollovers and most safe harbor contributions can never carry a schedule at all.",
  "Normal Retirement Age":
    "The age at which participants become fully vested automatically and may retire with full benefits.",
  "Participant Loans":
    "Whether employees may borrow from their own balance and repay it, with interest, back into their account.",
  "In-Service Distributions":
    "Whether participants can take money out while still employed, and on what grounds.",
  "Additional Distribution Events":
    "Optional withdrawal types added by SECURE 2.0. Adopting any of them is a choice, but the plan document has to say which apply.",
  "Rollover Contributions":
    "Whether the plan accepts money from a previous employer's plan or an IRA, letting employees consolidate their retirement savings.",
  "Plan Expenses":
    "Who pays to run the plan. Charging fees to plan assets reduces participant balances; the employer may pay them instead.",
  "Employer Payment Method":
    "How the employer settles plan invoices when it is paying the fees rather than the plan.",
  "Plan Trustees":
    "The people or institution that legally hold plan assets. Trustees are fiduciaries and are named in the trust agreement.",
  "Trustee Type":
    "A discretionary trustee decides how assets are invested. A directed trustee acts only on instructions.",
  "Custodian & Investment Providers":
    "A 403(b) holds assets in custodial accounts or annuity contracts rather than a trust, so it has a custodian or insurer instead of a trustee.",
  "Funding":
    "How and where plan assets are held — which for a non-governmental 457(b) means they are not set aside at all.",
  "Core Fund Lineup":
    "The investment options participants choose among. Selecting and monitoring the lineup is a fiduciary responsibility.",
  "Fiduciary Appointments":
    "The parties legally responsible for running the plan. ERISA requires the plan to name them, and they appear on Form 5500 and in participant disclosures.",
  "Effective Dates":
    "When the plan and this version of the document take effect. On a restatement the restated date is the operative one.",
  "Plan Legal Identity":
    "How the plan is identified to the IRS and DOL — its legal name, its three-digit plan number, and its plan year.",
  "Payroll Integration":
    "Who runs payroll, since employee deferrals are withheld through it and have to reach the recordkeeper each pay period.",
};

export function sectionHelp(heading: string): string | undefined {
  return SECTION_HELP[heading];
}

export function fieldHelp(field: string | undefined): string | undefined {
  return field ? FIELD_HELP[field] : undefined;
}
