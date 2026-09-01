import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { EligibilityStepSchema, type EligibilityStepInput } from "@vestara/shared";
import { usePlan } from "../../hooks/usePlan";
import { useUpdateStep, isApiValidationError } from "../../hooks/useUpdateStep";
import { FormField } from "../../components/FormField";
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

export function StepEligibility() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan } = usePlan(planId);
  const updateStep = useUpdateStep(planId, "eligibility");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<EligibilityStepInput>({
    resolver: zodResolver(EligibilityStepSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    const existing = plan?.stepData?.find((s: any) => s.stepKey === "eligibility")?.data;
    if (existing) reset({ ...defaults, ...existing });
  }, [plan, reset]);

  const autoEnrollElected = watch("autoEnrollElected");
  const autoEnrollType = watch("autoEnrollType");
  const autoEnrollEscalation = watch("autoEnrollEscalation");
  const values = watch();

  const pick = makeFieldSetter<EligibilityStepInput>(setValue);

  async function onSubmit(data: EligibilityStepInput) {
    try {
      await updateStep.mutateAsync(data);
      navigate(`/onboarding/${planId}/step/vesting`);
    } catch (err) {
      if (isApiValidationError(err)) {
        err.issues!.forEach((issue) =>
          setError(issue.path as keyof EligibilityStepInput, { message: issue.message }),
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

      {/* ── Service & Age ──────────────────────────────────── */}
      <div className="section-head">Service &amp; Age Requirements</div>
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
      </div>

      {/* ── Exclusions ─────────────────────────────────────── */}
      <div className="section-head">Excluded Employee Classes</div>
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

      {/* ── Automatic Enrollment ───────────────────────────── */}
      <div className="section-head">Automatic Enrollment</div>
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
              <option value="qaca">QACA — qualified (requires safe harbor)</option>
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
        </div>
      </RevealSection>

      <FormErrorSummary errors={errors} />

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
