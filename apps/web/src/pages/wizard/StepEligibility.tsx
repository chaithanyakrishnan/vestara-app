import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { buildEligibilitySchema, type EligibilityStepInput,
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
import { makeFieldSetter, numericField, optionalEnumField } from "../../lib/forms";

const defaults: EligibilityStepInput = {
  minimumAge: "21",
  serviceRequirement: "1yr",
  entryDates: "semi",
  hoursOfServiceMethod: "actual",
  excludeUnion: false,
  excludeNonResidentAliens: false,
  excludePartTime: false,
  excludeHce: false,
  autoEnrollElected: false,
};

const EXCLUSIONS = [
  { name: "excludeUnion", title: "Union / Collective Bargaining", desc: "Excludes employees covered by a CBA." },
  { name: "excludeNonResidentAliens", title: "Non-Resident Aliens", desc: "Excludes NRAs with no US-source income." },
  { name: "excludePartTime", title: "Part-Time / Temporary / Seasonal", desc: "Employees scheduled for fewer than 1,000 hours a year." },
  { name: "excludeHce", title: "Highly Compensated Employees", desc: "Rare. Generally requires a separate plan for HCEs." },
] as const;

const UA_EXCLUSIONS = [
  { value: "under_20_hours", label: "Employees normally working under 20 hours/week" },
  { value: "students", label: "Students performing services under Section 3121(b)(10)" },
  { value: "other_plan_eligible", label: "Employees eligible for another 403(b), 401(k) or 457(b)" },
  { value: "nonresident_aliens", label: "Non-resident aliens with no US-source income" },
] as const;

export function StepEligibility() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan } = usePlan(planId);
  const planType = usePlanType(plan);
  const profile = usePlanProfile(plan);
  const updateStep = useUpdateStep(planId, "eligibility");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<EligibilityStepInput>({
    resolver: usePlanTypeResolver<EligibilityStepInput>(buildEligibilitySchema, planType),
    defaultValues: defaults,
  });

  useEffect(() => {
    const existing = plan?.stepData?.find((s: any) => s.stepKey === "eligibility")?.data;
    // Always normalize — including when there is no saved data yet. The
    // `defaults` above are 401(k)-shaped, and carrying (say) catchupPermitted
    // "yes" into a 401(a) leaves an invalid value in a field that is no longer
    // rendered, which shows up to the user as a Continue button that does
    // nothing at all.
    reset(normalizeStepForPlanType("eligibility", { ...defaults, ...(existing ?? {}) }, planType) as any);
  }, [plan, planType, reset]);

  const autoEnrollElected = watch("autoEnrollElected");
  const excludePartTime = watch("excludePartTime");
  const autoEnrollType = watch("autoEnrollType");
  const autoEnrollEscalation = watch("autoEnrollEscalation");
  const values = watch();

  const pick = makeFieldSetter<EligibilityStepInput>(setValue);

  async function onSubmit(data: EligibilityStepInput) {
    setSubmitError(null);
    try {
      await updateStep.mutateAsync(data);
      navigate(`/onboarding/${planId}/step/vesting`);
    } catch (err) {
      if (isApiValidationError(err)) {
        err.issues!.forEach((issue) =>
          setError(issue.path as keyof EligibilityStepInput, { message: issue.message }),
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
    <AiProvenanceProvider plan={plan} stepKey="eligibility">
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="panel-eyebrow">Step 3 of 7</div>
      <div className="panel-title">Eligibility &amp; Entry</div>
      <div className="panel-desc">
        These rules determine when employees become eligible to participate. Conservative thresholds reduce
        administrative overhead; liberal thresholds may improve plan demographics for testing.
      </div>

      <AiSectionBanner plan={plan} stepKey="eligibility" />

      {/* ── Universal availability (403(b) only) ────────────────
          Section 403(b)(12)(A)(ii): elective deferrals must be offered to
          substantially all employees, so the age/service block below is
          replaced by the narrow list of permitted exclusions. */}
      {profile.universalAvailability && (
        <>
          <div className="section-head">
            Universal Availability <span className="section-badge">Section 403(b)(12)(A)(ii)</span>
          </div>
          <div className="inline-alert" style={{ marginBottom: 14 }}>
            A 403(b) cannot impose an age or service condition on elective deferrals. Only the
            statutory exclusions below are permitted, and applying one to any employee means
            applying it to every employee in that class.
          </div>
          <div className="form-grid">
            <FormField name="uaExclusions" label="Permitted Exclusions" colSpan2
              error={errors.uaExclusions as any}>
              <div className="checkbox-grid">
                {UA_EXCLUSIONS.map((c) => (
                  <label className="checkbox-row" key={c.value}>
                    <input type="checkbox" value={c.value} {...register("uaExclusions")} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </FormField>
          </div>
        </>
      )}

      {/* ── Top-hat group (non-governmental 457(b) only) ────────
          Eligibility is not a design choice here: participation MUST be
          limited to a select group of management or highly compensated
          employees or the plan loses its treatment. */}
      {profile.topHatOnly && (
        <>
          <div className="section-head">
        Eligible Class
        <SectionTip heading="Eligible Class" />
      </div>
          <div className="form-grid">
            <FormField name="eligibleClassDescription" label="Select Group Description" required colSpan2
              error={errors.eligibleClassDescription}
              hint="Describe the management or highly compensated group. Broad eligibility forfeits top-hat status.">
              <input {...register("eligibleClassDescription")}
                placeholder="e.g. Vice President and above, and directors earning over the HCE threshold" />
            </FormField>
          </div>
        </>
      )}

      {/* ── Service & Age ──────────────────────────────────── */}
      {!profile.universalAvailability && (
      <>
      <div className="section-head">
        Service &amp; Age Requirements
        <SectionTip heading="Service & Age Requirements" />
      </div>
      <div className="form-grid">
        <FormField name="minimumAge" label="Minimum Age" required error={errors.minimumAge}>
          <select {...register("minimumAge")}>
            <option value="none">No minimum age</option>
            <option value="18">Age 18</option>
            <option value="20.5">Age 20½</option>
            <option value="21">Age 21 (maximum permitted)</option>
          </select>
        </FormField>
        <FormField name="serviceRequirement" label="Service Requirement" required error={errors.serviceRequirement}>
          <select {...register("serviceRequirement")}>
            <option value="none">Immediate — no service requirement</option>
            <option value="3mo">3 months</option>
            <option value="6mo">6 months (no hours requirement)</option>
            <option value="1yr">1 Year of Service (1,000 hours)</option>
            <option value="2yr">2 Years (requires 100% vesting)</option>
          </select>
        </FormField>
        <FormField name="entryDates" label="Entry Dates" required error={errors.entryDates}>
          <select {...register("entryDates")}>
            <option value="immediate">Immediate upon eligibility</option>
            <option value="monthly">First of each month</option>
            <option value="quarterly">Quarterly (Jan 1, Apr 1, Jul 1, Oct 1)</option>
            <option value="semi">Semi-annual (Jan 1 &amp; Jul 1)</option>
            <option value="annual">Annual (first day of plan year)</option>
          </select>
        </FormField>
        <FormField name="hoursOfServiceMethod" label="Hours of Service Method" required error={errors.hoursOfServiceMethod}>
          <select {...register("hoursOfServiceMethod")}>
            <option value="actual">Actual hours</option>
            <option value="elapsed">Elapsed time</option>
            <option value="split">Split: actual (hourly) + equivalency (salaried)</option>
          </select>
        </FormField>
        {/* Section 401(k)(2)(D) forbids a two-year condition on elective deferrals,
            while Section 410(a)(1)(B)(i) permits one on employer money that vests
            immediately — so the two sources need separate answers. */}
        {profile.electiveDeferrals && (
          <FormField name="deferralServiceRequirement" label="Service Requirement — Deferrals"
            error={errors.deferralServiceRequirement}
            hint="Elective deferrals can never require more than one year of service.">
            <select {...register("deferralServiceRequirement", optionalEnumField)}>
              <option value="">Same as above</option>
              <option value="none">Immediate — no service requirement</option>
              <option value="3mo">3 months</option>
              <option value="6mo">6 months</option>
              <option value="1yr">1 Year of Service (maximum)</option>
            </select>
          </FormField>
        )}
      </div>
      </>
      )}

      {/* ── Exclusions ─────────────────────────────────────── */}
      {!profile.universalAvailability && (
      <>
      <div className="section-head">
        Excluded Employee Classes
        <SectionTip heading="Excluded Employee Classes" />
      </div>
      <OptionGrid cols={2}>
        {EXCLUSIONS.map((ex) => (
          <OptionCard
            key={ex.name}
            checkable
            selected={!!values[ex.name]}
            onSelect={() => pick(ex.name, !values[ex.name])}
            title={ex.title}
            desc={ex.desc}
          />
        ))}
      </OptionGrid>

      {/* SECURE 2.0 Section 125: two consecutive years of 500+ hours earns a deferral
          right from 2025. "Exclude part-time" is no longer a lawful blanket
          exclusion, so electing it requires acknowledging the LTPT track. */}
      {excludePartTime && profile.electiveDeferrals && (
        <div style={{ marginTop: 14 }}>
          <div className="inline-alert warn" style={{ marginBottom: 10 }}>
            Long-term part-time employees with two consecutive years of 500 or more hours must still
            be permitted to make elective deferrals (SECURE 2.0 Section 125). They may still be excluded
            from match and non-elective contributions.
          </div>
          <label className="checkbox-row">
            <input type="checkbox" {...register("ltptTrackingAcknowledged")} />
            <span>The plan will track part-time hours and admit long-term part-time employees for deferrals.</span>
          </label>
          {errors.ltptTrackingAcknowledged && (
            <div className="inline-alert error" style={{ marginTop: 8 }}>
              {errors.ltptTrackingAcknowledged.message}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* ── Automatic Enrollment ─────────────────────────────── */}
      {profile.autoEnrollmentAvailable && (
      <>
      <div className="section-head">
        Automatic Enrollment
        <SectionTip heading="Automatic Enrollment" />
      </div>
      <ToggleRow
        checked={!!autoEnrollElected}
        onChange={(next) => {
          pick("autoEnrollElected", next);
          if (!next) {
            pick("autoEnrollType", undefined);
            pick("autoEnrollDefaultPct", undefined);
            pick("autoEnrollEscalation", undefined);
            pick("autoEnrollEscalationCap", undefined);
          } else {
            // The schema requires a default deferral % once elected — seed the
            // SECURE 2.0 baseline rather than submitting an empty required field.
            if (!autoEnrollType) setValue("autoEnrollType", "eaca");
            setValue("autoEnrollDefaultPct", 3);
            setValue("autoEnrollEscalation", "1pct_yr");
            setValue("autoEnrollEscalationCap", 10);
          }
        }}
        label={
          <>
            Automatic Enrollment
            <span className="req-badge strong">Required for new plans after 12/31/2024</span>
          </>
        }
        sub="SECURE 2.0: new 401(k)/403(b) plans must auto-enroll at 3–10% with annual escalation to at least 10%."
      />
      <RevealSection open={!!autoEnrollElected}>
        <div className="form-grid" style={{ paddingTop: 16 }}>
          <FormField name="autoEnrollType" label="Auto-Enroll Type" error={errors.autoEnrollType}>
            <select {...register("autoEnrollType", optionalEnumField)}>
              <option value="basic">ACA — basic automatic contribution</option>
              <option value="eaca">EACA — eligible (6-month permissible withdrawal)</option>
              <option value="qaca">QACA — qualified (min 3%, must escalate to 6%)</option>
            </select>
          </FormField>
          <FormField name="autoEnrollDefaultPct" label="Default Deferral %" required error={errors.autoEnrollDefaultPct}>
            <AffixInput
              registration={register("autoEnrollDefaultPct", numericField)}
              suffix="%"
              type="number"
              step="1"
              min={1}
              max={15}
              placeholder="3"
            />
          </FormField>
          <FormField name="autoEnrollEscalation"
            label="Annual Escalation"
            error={errors.autoEnrollEscalation}
            hint="SECURE 2.0 requires escalation to at least 10% (max 15%) for plans subject to the mandate."
          >
            <select
              {...register("autoEnrollEscalation", {
                onChange: (e) => {
                  // A cap is meaningless without escalation.
                  if (e.target.value === "none") pick("autoEnrollEscalationCap", undefined);
                  else if (!watch("autoEnrollEscalationCap")) setValue("autoEnrollEscalationCap", 10);
                },
              })}
            >
              <option value="none">No escalation</option>
              <option value="1pct_yr">+1% per year</option>
              <option value="2pct_yr">+2% per year</option>
            </select>
          </FormField>
          <RevealSection open={!!autoEnrollEscalation && autoEnrollEscalation !== "none"}>
            <FormField name="autoEnrollEscalationCap" label="Escalation Cap" error={errors.autoEnrollEscalationCap}>
              <AffixInput
                registration={register("autoEnrollEscalationCap", numericField)}
                suffix="%"
                type="number"
                step="1"
                min={1}
                max={15}
                placeholder="10"
              />
            </FormField>
          </RevealSection>
          {/* An EACA must state whether it permits the 90-day withdrawal —
              a required election, previously uncaptured. */}
          {autoEnrollType === "eaca" && (
            <FormField name="eacaPermissibleWithdrawal" label="90-Day Permissible Withdrawal" colSpan2
              error={errors.eacaPermissibleWithdrawal}
              hint="An EACA may let a participant withdraw automatic contributions within 90 days of the first deduction.">
              <label className="checkbox-row">
                <input type="checkbox" {...register("eacaPermissibleWithdrawal")} />
                <span>Permit the 90-day withdrawal election.</span>
              </label>
            </FormField>
          )}
        </div>
      </RevealSection>
      </>
      )}

      <FormErrorSummary errors={errors} submitError={submitError} />

      <div className="panel-actions">
        <button type="button" className="btn-back" onClick={() => navigate(`/onboarding/${planId}/step/contributions`)}>
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
