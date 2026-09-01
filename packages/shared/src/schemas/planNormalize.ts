import { planProfile } from "./planProfile";

/**
 * Statutory minimums per safe harbor formula. Shared with the Contributions
 * form so the rates it pre-fills and the rates this repairs cannot drift.
 * Basic is 100% of the first 3% plus 50% of the next 2%; QACA basic is 100% of
 * the first 1% plus 50% from 1% to 6%; the non-elective floor is 3%.
 */
export const SAFE_HARBOR_DEFAULT_RATES: Record<
  string,
  {
    safeHarborMatchTier1Pct?: number;
    safeHarborMatchTier1UpToPct?: number;
    safeHarborMatchTier2Pct?: number;
    safeHarborMatchTier2UpToPct?: number;
    safeHarborNonelectivePct?: number;
  }
> = {
  basic: {
    safeHarborMatchTier1Pct: 100,
    safeHarborMatchTier1UpToPct: 3,
    safeHarborMatchTier2Pct: 50,
    safeHarborMatchTier2UpToPct: 5,
  },
  enhanced: { safeHarborMatchTier1Pct: 100, safeHarborMatchTier1UpToPct: 4 },
  ne: { safeHarborNonelectivePct: 3 },
  qaca: {
    safeHarborMatchTier1Pct: 100,
    safeHarborMatchTier1UpToPct: 1,
    safeHarborMatchTier2Pct: 50,
    safeHarborMatchTier2UpToPct: 6,
    safeHarborNonelectivePct: 3,
  },
};

/**
 * Strips elections a plan type cannot have, before a form hydrates.
 *
 * Without this, switching a draft to another plan type — or loading one the AI
 * pre-filled from a 401(k)-shaped sample — leaves values in fields that are no
 * longer RENDERED. The schema rejects them, the error has nowhere to display,
 * and Continue silently does nothing. That is the exact failure the
 * FormErrorSummary was introduced to prevent, and a hidden field defeats it.
 *
 * So: anything the profile says is unavailable is cleared here rather than
 * being left to fail validation somewhere the user cannot see or reach.
 *
 * This runs on HYDRATION only. It never overrides a choice the user can
 * actually see and change — if a field is visible, its value is theirs.
 */
export function normalizeStepForPlanType(
  stepKey: string,
  data: Record<string, any>,
  planType?: string,
): Record<string, any> {
  const p = planProfile(planType);
  const d = { ...data };

  switch (stepKey) {
    case "contributions": {
      if (!p.electiveDeferrals) {
        // A 401(a) has no deferral feature; the whole block is hidden.
        d.pretaxDeferrals = undefined;
        d.rothDeferrals = undefined;
      } else if (!p.rothAvailable) {
        d.rothDeferrals = false;
      }

      // Catch-ups: each kind is offered only where it exists.
      if (!p.availableCatchUps.includes("age50")) d.catchupPermitted = "no";
      if (!p.availableCatchUps.includes("super60to63")) d.superCatchupPermitted = undefined;
      if (!p.availableCatchUps.includes("service15")) d.service15CatchupPermitted = undefined;
      if (!p.availableCatchUps.includes("final3")) d.final3CatchupPermitted = undefined;

      // SECURE 2.0 Section 603 makes catch-up Roth for higher-paid participants,
      // so a plan permitting catch-up needs a Roth source. Seeded on hydration
      // rather than leaving the form to open already failing on a box the user
      // never touched. Unticking Roth afterwards is their call, and then the
      // error lands on a field they can actually see.
      if (d.catchupPermitted === "yes" && p.rothAvailable && !d.rothDeferrals) {
        d.rothDeferrals = true;
      }

      // A plan with no deferral feature still has to elect employer money.
      if (!p.electiveDeferrals && !d.matchElected && !d.nonelectiveElected) {
        d.nonelectiveElected = true;
      }

      if (!p.safeHarborAvailable) {
        d.safeHarborElected = false;
        d.safeHarborType = undefined;
        d.safeHarborPeriod = undefined;
        d.safeHarborAppliesTo = undefined;
        d.safeHarborMatchTier1Pct = undefined;
        d.safeHarborMatchTier1UpToPct = undefined;
        d.safeHarborMatchTier2Pct = undefined;
        d.safeHarborMatchTier2UpToPct = undefined;
        d.safeHarborNonelectivePct = undefined;
      }
      if (!p.adpAcpTesting) {
        d.adpTestMethod = undefined;
        d.topHeavyMinimumBy = undefined;
      }

      // Repair a draft saved before the formula rates were captured: it holds a
      // safe harbor TYPE and no rates, which now fails on fields the user never
      // saw when they made the election.
      if (d.safeHarborElected && p.safeHarborAvailable && d.safeHarborType) {
        const rates = SAFE_HARBOR_DEFAULT_RATES[d.safeHarborType] ?? {};
        for (const [field, value] of Object.entries(rates)) {
          if (d[field] === undefined) d[field] = value;
        }
      }
      break;
    }

    case "eligibility": {
      if (p.universalAvailability) {
        // 403(b): no age or service condition may attach to deferrals, and the
        // broad exclusion classes are replaced by the statutory shortlist.
        d.minimumAge = "none";
        d.deferralServiceRequirement = "none";
        d.excludeUnion = false;
        d.excludeHce = false;
        d.excludePartTime = false;
      }
      if (!p.autoEnrollmentAvailable) {
        d.autoEnrollElected = false;
        d.autoEnrollType = undefined;
        d.autoEnrollDefaultPct = undefined;
        d.autoEnrollEscalation = undefined;
        d.autoEnrollEscalationCap = undefined;
        d.eacaPermissibleWithdrawal = undefined;
      }
      if (!p.topHatOnly) d.eligibleClassDescription = undefined;
      break;
    }

    case "vesting": {
      if (!p.topHatOnly) d.substantialRiskOfForfeiture = undefined;
      // Most top-hat deferrals are fully vested when deferred; "none" is the
      // ordinary answer and the select stays visible for the other two.
      else if (d.substantialRiskOfForfeiture === undefined) d.substantialRiskOfForfeiture = "none";
      // Safe harbor contributions must be 100% vested immediately (QACA may use
      // a two-year cliff). Leaving this unset means it inherits the plan's
      // schedule, which irsVestingFloor.ts then rejects with a 422 — correctly,
      // but for a value the user never chose.
      if (p.erisaVestingFloors && d.safeHarborVesting === undefined) {
        d.safeHarborVesting = "imm";
      }
      if (!p.erisaVestingFloors) {
        d.matchVesting = undefined;
        d.nonelectiveVesting = undefined;
        d.safeHarborVesting = undefined;
      }
      break;
    }

    case "administration": {
      if (!p.loansAvailable) {
        d.loansPermitted = false;
        d.loanMinAmount = undefined;
        d.loanMaxBasis = undefined;
        d.loanGeneralMaxTermYears = undefined;
        d.loanMaxOutstanding = undefined;
        d.loanInterestRate = undefined;
        d.loanPurpose = undefined;
        d.loanHomeMaxTermYears = undefined;
        d.loanRefinancing = undefined;
        d.loanAcceleration = undefined;
        d.loanPaymentsOnLeave = undefined;
      }
      if (!p.hardshipAvailable) {
        d.hardshipElected = false;
        d.hardshipType = undefined;
        d.hardshipSelfCertification = undefined;
      }
      if (!p.unforeseeableEmergency) d.unforeseeableEmergencyElected = undefined;
      if (!p.inServiceAt59_5) d.inServiceAt59_5 = false;
      if (!p.rothAvailable) d.inPlanRothConversion = undefined;
      if (p.key.startsWith("457b")) d.emergencyExpenseWithdrawal = undefined;
      break;
    }

    case "trustees_funds": {
      if (!p.requiresTrustee) {
        d.trustees = [];
        d.trusteeType = undefined;
      }
      if (p.fundingVehicle !== "custodial_annuity") d.custodianName = undefined;
      if (!p.erisa404cAvailable) d.claims404c = false;
      if (!p.files5500) {
        d.planAdministratorName = undefined;
        d.namedFiduciary = undefined;
        d.agentForServiceOfProcess = undefined;
        d.fidelityBondCarrier = undefined;
        d.fidelityBondAmount = undefined;
      }
      break;
    }

    case "identity": {
      if (p.key !== "403b") {
        d.erisaStatus = undefined;
        d.organizationType = undefined;
      }
      if (p.key !== "457b_gov") d.governmentalEntityType = undefined;
      if (p.key !== "457b_nongov") d.topHatCertified = undefined;
      if (p.key !== "401a") d.planSubtype = undefined;
      if (p.fundingVehicle === "unfunded" || p.fundingVehicle === "custodial_annuity") {
        d.trustName = "";
      }
      break;
    }
  }

  return d;
}
