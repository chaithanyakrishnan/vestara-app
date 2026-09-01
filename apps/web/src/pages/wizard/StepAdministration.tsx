import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { buildAdministrationSchema, type AdministrationStepInput,
  normalizeStepForPlanType,
} from "@vestara/shared";
import { usePlan } from "../../hooks/usePlan";
import { usePlanProfile, usePlanType, usePlanTypeResolver } from "../../hooks/usePlanTypeForm";
import { useUpdateStep, isApiValidationError } from "../../hooks/useUpdateStep";
import { FormField } from "../../components/FormField";
import { SectionTip } from "../../components/InfoTip";
import { FormErrorSummary } from "../../components/FormErrorSummary";
import { OptionCard, OptionGrid } from "../../components/OptionCard";
import { ToggleRow, RevealSection } from "../../components/ToggleRow";
import { AffixInput } from "../../components/AffixInput";
import { AiSectionBanner } from "../../components/AiSectionBanner";
import { AiProvenanceProvider } from "../../components/AiProvenance";
import { BANKS } from "../../data/datalists";
import { makeFieldSetter, numericField, optionalEnumField } from "../../lib/forms";

const defaults: AdministrationStepInput = {
  // Age 73 is the current required beginning age; 75 applies from 2033.
  requiredBeginningAge: "73",
  loansPermitted: false,
  inServiceAt59_5: false,
  hardshipElected: false,
  rolloversAccepted: true,
  rolloverSources: "all",
  planExpensePayer: "plan",
};

export function StepAdministration() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan } = usePlan(planId);
  const planType = usePlanType(plan);
  const profile = usePlanProfile(plan);
  const updateStep = useUpdateStep(planId, "administration");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<AdministrationStepInput>({
    resolver: usePlanTypeResolver<AdministrationStepInput>(buildAdministrationSchema, planType),
    defaultValues: defaults,
  });

  useEffect(() => {
    const existing = plan?.stepData?.find((s: any) => s.stepKey === "administration")?.data;
    // Always normalize — including when there is no saved data yet. The
    // `defaults` above are 401(k)-shaped, and carrying (say) catchupPermitted
    // "yes" into a 401(a) leaves an invalid value in a field that is no longer
    // rendered, which shows up to the user as a Continue button that does
    // nothing at all.
    reset(normalizeStepForPlanType("administration", { ...defaults, ...(existing ?? {}) }, planType) as any);
  }, [plan, planType, reset]);

  const loansPermitted = watch("loansPermitted");
  const inService = watch("inServiceAt59_5");
  const unforeseeableEmergencyElected = watch("unforeseeableEmergencyElected");
  const hardshipElected = watch("hardshipElected");
  const hardshipType = watch("hardshipType");
  const rolloversAccepted = watch("rolloversAccepted");
  const planExpensePayer = watch("planExpensePayer");
  const paymentMethod = watch("employerPaymentMethod");

  const pick = makeFieldSetter<AdministrationStepInput>(setValue);

  async function onSubmit(data: AdministrationStepInput) {
    setSubmitError(null);
    try {
      await updateStep.mutateAsync(data);
      navigate(`/onboarding/${planId}/step/trustees_funds`);
    } catch (err) {
      if (isApiValidationError(err)) {
        err.issues!.forEach((issue) =>
          setError(issue.path as keyof AdministrationStepInput, { message: issue.message }),
        );
      } else {
        // A 422 from a cross-step business rule (see irsVestingFloor.ts)
        // carries a message but no field issues. Without this branch the
        // request failed and nothing at all appeared on screen.
        setSubmitError(
          err instanceof Error && err.message ? err.message : "Could not save this step. Please try again.",
        );
      }
    }
  }

  return (
    <AiProvenanceProvider plan={plan} stepKey="administration">
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="panel-eyebrow">Step 5 of 7</div>
      <div className="panel-title">Plan Administration</div>
      <div className="panel-desc">
        These elections govern day-to-day plan operations. They appear in the Summary Plan Description and
        are the ones participants ask about most.
      </div>

      <AiSectionBanner plan={plan} stepKey="administration" />

      {/* ── Loans ───────────────────────────────────────────────
          A non-governmental 457(b) cannot offer loans: deferred amounts are
          the employer's general assets, so there is nothing to lend against. */}
      {!profile.loansAvailable && (
        <div className="inline-alert" style={{ marginBottom: 16 }}>
          Participant loans are not available in a {profile.label} plan — deferred amounts remain
          the employer's general assets until distributed.
        </div>
      )}
      {profile.loansAvailable && (
      <>
      <div className="section-head">
        Participant Loans
        <SectionTip heading="Participant Loans" />
      </div>
      <ToggleRow
        checked={!!loansPermitted}
        onChange={(next) => {
          pick("loansPermitted", next);
          if (!next) {
            pick("loanMinAmount", undefined);
            pick("loanMaxOutstanding", undefined);
            pick("loanInterestRate", undefined);
            pick("loanPurpose", undefined);
            pick("loanHomeMaxTermYears", undefined);
            pick("loanRefinancing", undefined);
            pick("loanAcceleration", undefined);
            pick("loanPaymentsOnLeave", undefined);
          } else {
            // loanMinAmount is required by the schema once loans are on.
            setValue("loanMinAmount", 1000);
            setValue("loanMaxOutstanding", "1");
            setValue("loanInterestRate", "prime1");
            setValue("loanPurpose", "any");
            setValue("loanHomeMaxTermYears", 10);
            setValue("loanRefinancing", "not_allowed");
            setValue("loanAcceleration", "on_termination");
            setValue("loanPaymentsOnLeave", "suspend");
          }
        }}
        label="Loans Permitted"
        sub="Participants may borrow against their vested account balance."
      />
      <RevealSection open={!!loansPermitted}>
        <div className="loan-detail">
          <div className="form-grid triple">
            <FormField name="loanMinAmount" label="Minimum Loan Amount" required error={errors.loanMinAmount}>
              <AffixInput
                registration={register("loanMinAmount", numericField)}
                prefix="$"
                className="mono"
                type="number"
                min={0}
                step={100}
                placeholder="1000"
              />
            </FormField>
            <FormField name="loanMaxBasis" label="Maximum Loan" required error={errors.loanMaxBasis}
              hint="Section 72(p)(2)(A) caps a loan at the lesser of $50,000 or half the vested balance.">
              <select {...register("loanMaxBasis", optionalEnumField)}>
                <option value="">Select…</option>
                <option value="statutory">Statutory maximum — lesser of $50,000 or 50% vested</option>
                <option value="lesser_of_50pct">50% of vested balance, no dollar cap increase</option>
                <option value="custom">Lower plan-specific limit</option>
              </select>
            </FormField>
            <FormField name="loanGeneralMaxTermYears" label="General-Purpose Loan Term" required
              error={errors.loanGeneralMaxTermYears}
              hint="Section 72(p)(2)(B): five years maximum, except a principal residence loan.">
              <AffixInput suffix="yrs" registration={register("loanGeneralMaxTermYears", numericField)}
                type="number" step="1" min={1} max={5} placeholder="5" />
            </FormField>
            <FormField name="loanMaxOutstanding" label="Max Loans Outstanding" error={errors.loanMaxOutstanding}>
              <select {...register("loanMaxOutstanding", optionalEnumField)}>
                <option value="1">1 loan at a time</option>
                <option value="2">2 loans</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </FormField>
            <FormField name="loanInterestRate" label="Interest Rate" error={errors.loanInterestRate}>
              <select {...register("loanInterestRate", optionalEnumField)}>
                <option value="prime">Prime</option>
                <option value="prime1">Prime + 1%</option>
                <option value="prime2">Prime + 2%</option>
              </select>
            </FormField>
            <FormField name="loanPurpose" label="Loan Purpose" error={errors.loanPurpose}>
              <select {...register("loanPurpose", optionalEnumField)}>
                <option value="any">Any reasonable purpose</option>
                <option value="principal_residence_only">Restricted purposes only</option>
              </select>
            </FormField>
            <FormField name="loanHomeMaxTermYears" label="Home Loan Max Term" error={errors.loanHomeMaxTermYears}>
              <AffixInput
                registration={register("loanHomeMaxTermYears", numericField)}
                suffix="yrs"
                type="number"
                min={1}
                max={30}
                step={1}
                placeholder="10"
              />
            </FormField>
            <FormField name="loanRefinancing" label="Refinancing" error={errors.loanRefinancing}>
              <select {...register("loanRefinancing", optionalEnumField)}>
                <option value="not_allowed">Not permitted</option>
                <option value="allowed">Permitted</option>
              </select>
            </FormField>
            <FormField name="loanAcceleration" label="Loan Acceleration" colSpan3 error={errors.loanAcceleration}>
              <select {...register("loanAcceleration", optionalEnumField)}>
                <option value="on_termination">Accelerate on severance or plan termination</option>
                <option value="never">No acceleration</option>
              </select>
            </FormField>
            <FormField name="loanPaymentsOnLeave" label="Payments on Leave of Absence" colSpan3 error={errors.loanPaymentsOnLeave}>
              <select {...register("loanPaymentsOnLeave", optionalEnumField)}>
                <option value="suspend">Suspend payments during leave</option>
                <option value="continue">Continue payments during all leave</option>
              </select>
            </FormField>
          </div>
        </div>
      </RevealSection>

      </>
      )}

      {/* ── In-service distributions ──────────────────────── */}
      <div className="section-head">
        In-Service Distributions
        <SectionTip heading="In-Service Distributions" />
      </div>

      {/* Section 457(b) non-governmental: distributions are restricted to separation,
          age 70½, unforeseeable emergency, or death/disability. There is no
          age-59½ in-service event to offer. */}
      {profile.inServiceAt59_5 ? (
        <ToggleRow
          checked={!!inService}
          onChange={(next) => pick("inServiceAt59_5", next)}
          label="Age 59½ In-Service Withdrawals"
          sub="Participants aged 59½ or older may withdraw from any account while still employed."
        />
      ) : (
        <div className="inline-alert warn">
          No in-service withdrawals at age 59½. A {profile.label} plan restricts distributions to
          separation from service, age 70½, an unforeseeable emergency, or death or disability.
        </div>
      )}

      {/* Section 457(b) uses "unforeseeable emergency" — a stricter and legally
          distinct standard from Section 401(k) hardship, not a synonym. */}
      {profile.unforeseeableEmergency && (
        <div style={{ marginTop: 10 }}>
          <ToggleRow
            checked={!!unforeseeableEmergencyElected}
            onChange={(next) => pick("unforeseeableEmergencyElected", next)}
            label="Unforeseeable Emergency Distributions"
            sub="A severe financial hardship from an event beyond the participant's control, and only to the extent not relievable by insurance, liquidation of assets, or ceasing deferrals."
          />
        </div>
      )}

      {profile.hardshipAvailable && (
      <div style={{ marginTop: 10 }}>
        <ToggleRow
          checked={!!hardshipElected}
          onChange={(next) => {
            pick("hardshipElected", next);
            if (!next) pick("hardshipType", undefined);
            else if (!hardshipType) setValue("hardshipType", "safe");
          }}
          label="Hardship Distributions"
          sub="Allows withdrawals for IRS-defined financial hardship events."
        />
        <RevealSection open={!!hardshipElected}>
          <div style={{ paddingTop: 12 }}>
            <OptionGrid cols={2}>
              <OptionCard
                selected={hardshipType === "safe"}
                onSelect={() => pick("hardshipType", "safe")}
                title="Safe Harbor Hardship"
                desc="IRS-defined events. No facts-and-circumstances inquiry needed."
              />
              <OptionCard
                selected={hardshipType === "non"}
                onSelect={() => pick("hardshipType", "non")}
                title="Non-Safe Harbor"
                desc="Broader events permitted, but requires case-by-case review."
              />
            </OptionGrid>
            {/* SECURE 2.0 Section 312 — the participant may self-certify the need. */}
            <div style={{ marginTop: 12 }}>
              <label className="checkbox-row">
                <input type="checkbox" {...register("hardshipSelfCertification")} />
                <span>Permit employee self-certification of the hardship need (SECURE 2.0 Section 312).</span>
              </label>
            </div>
          </div>
        </RevealSection>
      </div>
      )}

      {/* ── SECURE 2.0 distribution events ──────────────────────
          Optional withdrawal types a plan adopted today has to decide on.
          None of these had a field before. */}
      <div className="section-head">
        Additional Distribution Events
        <SectionTip heading="Additional Distribution Events" />
      </div>
      <div className="form-grid">
        <FormField name="requiredBeginningAge" label="Required Beginning Age" required
          error={errors.requiredBeginningAge}
          hint="SECURE 2.0 Section 107 raised the required beginning date to age 73, rising to 75 in 2033.">
          <select {...register("requiredBeginningAge", optionalEnumField)}>
            <option value="">Select…</option>
            <option value="73">Age 73</option>
            <option value="75">Age 75 (from 2033)</option>
          </select>
        </FormField>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="checkbox-grid">
          {!profile.key.startsWith("457b") && (
            <label className="checkbox-row">
              <input type="checkbox" {...register("emergencyExpenseWithdrawal")} />
              <span>Emergency personal expense withdrawal — $1,000/year (Section 115)</span>
            </label>
          )}
          <label className="checkbox-row">
            <input type="checkbox" {...register("domesticAbuseWithdrawal")} />
            <span>Domestic abuse victim distribution (Section 314)</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" {...register("birthAdoptionWithdrawal")} />
            <span>Qualified birth or adoption distribution (Section 113)</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" {...register("qualifiedDisasterWithdrawal")} />
            <span>Qualified disaster recovery distribution</span>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" {...register("inServiceFromRollover")} />
            <span>In-service withdrawal from rollover account at any age</span>
          </label>
          {profile.rothAvailable && (
            <label className="checkbox-row">
              <input type="checkbox" {...register("inPlanRothConversion")} />
              <span>In-plan Roth conversion</span>
            </label>
          )}
        </div>
      </div>

      {/* ── Rollovers ─────────────────────────────────────── */}
      <div className="section-head">
        Rollover Contributions
        <SectionTip heading="Rollover Contributions" />
      </div>
      <ToggleRow
        checked={!!rolloversAccepted}
        onChange={(next) => {
          pick("rolloversAccepted", next);
          setValue("rolloverSources", next ? "all" : "none");
        }}
        label="Accept Rollover Contributions"
        sub={
          profile.key === "457b_nongov"
            ? "A non-governmental 457(b) may only accept transfers from another non-governmental 457(b) — not from an IRA, 401(k) or 403(b)."
            : "The plan will accept rollovers from qualified plans, IRAs, and 403(b)s."
        }
      />
      <RevealSection open={!!rolloversAccepted}>
        <div className="form-grid" style={{ paddingTop: 12 }}>
          <FormField name="rolloverSources" label="Accepted Sources" colSpan2 error={errors.rolloverSources}>
            <select {...register("rolloverSources", optionalEnumField)}>
              <option value="all">All eligible retirement plans (recommended)</option>
              <option value="qualified_only">Qualified plans only — 401(k), 403(b), 457</option>
              <option value="none">None</option>
            </select>
          </FormField>
        </div>
      </RevealSection>

      {/* ── Plan expenses ─────────────────────────────────── */}
      <div className="section-head">
        Plan Expenses
        <SectionTip heading="Plan Expenses" />
      </div>
      {errors.planExpensePayer && (
        <div className="inline-alert error" style={{ marginBottom: 12 }}>{errors.planExpensePayer.message}</div>
      )}
      <OptionGrid cols={2}>
        <OptionCard
          selected={planExpensePayer === "employer"}
          onSelect={() => pick("planExpensePayer", "employer")}
          title="Employer Pays"
          desc="Employer pays all non-settlor plan expenses. The plan bears only intrinsic costs."
        />
        <OptionCard
          selected={planExpensePayer === "plan"}
          onSelect={() => {
            pick("planExpensePayer", "plan");
            pick("employerPaymentMethod", undefined);
            pick("employerPaymentBankName", undefined);
            pick("employerPaymentAccountType", undefined);
            pick("employerPaymentRoutingNumber", undefined);
            pick("employerPaymentAccountNumber", undefined);
          }}
          title="Plan Pays"
          desc="Plan assets pay administration, recordkeeping, and advisory fees."
        />
      </OptionGrid>

      <RevealSection open={planExpensePayer === "employer"}>
        <div className="section-head" style={{ marginTop: 20 }}>
        Employer Payment Method
        <SectionTip heading="Employer Payment Method" />
      </div>
        <div className="form-grid">
          <FormField name="employerPaymentMethod" label="Payment Method" required error={errors.employerPaymentMethod}>
            <select {...register("employerPaymentMethod", optionalEnumField)}>
              <option value="">Select…</option>
              <option value="ach">ACH — automatic bank draft</option>
              <option value="wire">Wire transfer</option>
              <option value="check">Check</option>
            </select>
          </FormField>
          <FormField name="employerPaymentBankName"
            label="Bank Name"
            required={paymentMethod === "ach"}
            error={errors.employerPaymentBankName}
          >
            <input {...register("employerPaymentBankName")} list="bankList" placeholder="e.g. Chase, Wells Fargo…" />
            <datalist id="bankList">
              {BANKS.map((b) => <option key={b} value={b} />)}
            </datalist>
          </FormField>

          <RevealSection open={paymentMethod === "ach"}>
            <div className="form-grid" style={{ marginBottom: 0 }}>
              <FormField name="employerPaymentRoutingNumber"
                label="Routing Number"
                required
                error={errors.employerPaymentRoutingNumber}
                hint="9 digits."
              >
                <input className="mono" inputMode="numeric" maxLength={9} placeholder="123456789" {...register("employerPaymentRoutingNumber")} />
              </FormField>
              <FormField name="employerPaymentAccountNumber" label="Account Number" required error={errors.employerPaymentAccountNumber}>
                <input className="mono" inputMode="numeric" maxLength={17} placeholder="Account number" {...register("employerPaymentAccountNumber")} />
              </FormField>
              <FormField name="employerPaymentAccountType" label="Account Type" error={errors.employerPaymentAccountType}>
                <select {...register("employerPaymentAccountType", optionalEnumField)}>
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                </select>
              </FormField>
            </div>
          </RevealSection>
        </div>
      </RevealSection>

      <FormErrorSummary errors={errors} submitError={submitError} />

      <div className="panel-actions">
        <button type="button" className="btn-back" onClick={() => navigate(`/onboarding/${planId}/step/vesting`)}>
          ← Back
        </button>
        <button className="btn-primary" type="submit" disabled={updateStep.isPending}>
          {updateStep.isPending ? "Saving…" : "Continue"}
        </button>
      </div>
    </form>
    </AiProvenanceProvider>
  );
}
