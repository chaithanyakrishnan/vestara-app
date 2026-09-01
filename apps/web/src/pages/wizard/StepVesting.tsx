import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { buildVestingSchema, type VestingStepInput,
  normalizeStepForPlanType,
} from "@vestara/shared";
import { usePlan } from "../../hooks/usePlan";
import { usePlanProfile, usePlanType, usePlanTypeResolver } from "../../hooks/usePlanTypeForm";
import { useUpdateStep, isApiValidationError } from "../../hooks/useUpdateStep";
import { FormField } from "../../components/FormField";
import { SectionTip } from "../../components/InfoTip";
import { FormErrorSummary } from "../../components/FormErrorSummary";
import { OptionCard, OptionGrid } from "../../components/OptionCard";
import { AiSectionBanner } from "../../components/AiSectionBanner";
import { AiProvenanceProvider } from "../../components/AiProvenance";
import { VEST_SCHEDULES, rowsForSchedule } from "../../data/vestingPresets";
import { numericField, optionalEnumField } from "../../lib/forms";

const defaults: VestingStepInput = {
  scheduleType: "6graded",
  customSchedule: rowsForSchedule("6graded"),
  // Safe harbor money must vest immediately (QACA aside), so defaulting this
  // to the plan's headline schedule guaranteed a server-side 422 for every
  // safe harbor plan — the plan schedule is exactly what it may not use.
  safeHarborVesting: "imm",
  normalRetirementAge: "65",
  vestingOnDeathDisability: "both",
};

const SCHEDULES = [
  { value: "imm", title: "Immediate", formula: "Year 0 → 100%", desc: "100% vested from day one. No forfeiture risk." },
  { value: "3cliff", title: "3-Year Cliff", formula: "Year 0–2 → 0% · Year 3+ → 100%", desc: "Nothing vests until year 3, then everything. Simple to administer." },
  { value: "6graded", title: "6-Year Graded", formula: "0 / 0 / 20 / 40 / 60 / 80 / 100%", desc: "20% per year starting at year 2. The maximum schedule allowed." },
  { value: "custom", title: "Custom Schedule", formula: "Edit the table below", desc: "Define your own graded ladder. Must meet Code Section 411(a)." },
] as const;

export function StepVesting() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan } = usePlan(planId);
  const planType = usePlanType(plan);
  const profile = usePlanProfile(plan);
  const updateStep = useUpdateStep(planId, "vesting");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    setError,
    formState: { errors },
  } = useForm<VestingStepInput>({
    resolver: usePlanTypeResolver<VestingStepInput>(buildVestingSchema, planType),
    defaultValues: defaults,
  });

  const { fields, replace } = useFieldArray({ control, name: "customSchedule" });

  useEffect(() => {
    const existing = plan?.stepData?.find((s: any) => s.stepKey === "vesting")?.data;
    // Always normalize — including when there is no saved data yet. The
    // `defaults` above are 401(k)-shaped, and carrying (say) catchupPermitted
    // "yes" into a 401(a) leaves an invalid value in a field that is no longer
    // rendered, which shows up to the user as a Continue button that does
    // nothing at all.
    reset(normalizeStepForPlanType("vesting", { ...defaults, ...(existing ?? {}) }, planType) as any);
  }, [plan, planType, reset]);

  const scheduleType = watch("scheduleType");
  const isCustom = scheduleType === "custom";
  const isImmediate = scheduleType === "imm";

  function chooseSchedule(next: VestingStepInput["scheduleType"]) {
    setValue("scheduleType", next, { shouldValidate: true, shouldDirty: true });
    // Always rewrite the rows to match the picked ladder. The schema only
    // *requires* customSchedule for "custom", but storing the preset's rows for
    // the others keeps the Review screen and any downstream consumer honest.
    replace(rowsForSchedule(next));
  }

  async function onSubmit(data: VestingStepInput) {
    setSubmitError(null);
    try {
      await updateStep.mutateAsync(data);
      navigate(`/onboarding/${planId}/step/administration`);
    } catch (err) {
      if (isApiValidationError(err)) {
        err.issues!.forEach((issue) =>
          setError(issue.path as keyof VestingStepInput, { message: issue.message }),
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

  // Display-only minimums for the current ladder, keyed by row index.
  const minimums = VEST_SCHEDULES[scheduleType ?? "custom"] ?? [];

  return (
    <AiProvenanceProvider plan={plan} stepKey="vesting">
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="panel-eyebrow">Step 4 of 7</div>
      <div className="panel-title">Vesting</div>
      <div className="panel-desc">
        Vesting determines when employer contributions become the participant's property. Employees are
        always 100% vested in their own deferrals.
      </div>

      <AiSectionBanner plan={plan} stepKey="vesting" />

      <div className="section-head">
        Schedule Type
        <SectionTip heading="Schedule Type" />
      </div>
      <OptionGrid cols={2}>
        {SCHEDULES.map((s) => (
          <OptionCard
            key={s.value}
            selected={scheduleType === s.value}
            onSelect={() => chooseSchedule(s.value)}
            title={s.title}
            formula={s.formula}
            desc={s.desc}
          />
        ))}
      </OptionGrid>

      {!isImmediate && (
        <div style={{ marginTop: 20 }}>
          {/* Both customSchedule issues attach to the ARRAY ROOT, not a row, so
              they have to render above the table rather than per-input. */}
          {errors.customSchedule && (
            <div className="inline-alert error" style={{ marginBottom: 12 }}>
              {errors.customSchedule.message ?? "Check the vesting schedule below."}
            </div>
          )}
          <table className="vesting-table">
            <thead>
              <tr>
                <th>Years of Service</th>
                <th>Vested %</th>
                <th>Statutory Minimum</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => (
                <tr key={field.id}>
                  <td>{field.yearLabel}</td>
                  <td>
                    {isCustom ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={10}
                        {...register(`customSchedule.${i}.pct` as const, numericField)}
                      />
                    ) : (
                      <strong style={{ color: "var(--cream)" }}>{field.pct}%</strong>
                    )}
                  </td>
                  <td style={{ color: "var(--muted)", fontSize: 11 }}>≥ {minimums[i]?.minPct ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* yearLabel is part of the schema but not user-editable — keep it in
              the payload without rendering a redundant text box per row. */}
          {fields.map((field, i) => (
            <input key={field.id} type="hidden" {...register(`customSchedule.${i}.yearLabel` as const)} />
          ))}
          <div className="inline-alert info" style={{ marginTop: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            Must satisfy Code Section 411(a)(2)(B): each year vests at least as much as the prior year, and the
            schedule reaches 100% by year 6. Checked again on save.
          </div>
        </div>
      )}

      {/* ── Per-source schedules ────────────────────────────────
          Vesting is a property of each MONEY SOURCE, not of the plan. Several
          can never carry a schedule: elective deferrals, safe harbor
          non-elective and basic/enhanced match, QNECs, QMACs and rollovers.
          Modelling one schedule plan-wide let a user elect safe harbor
          non-elective and a six-year graded schedule together. */}
      {profile.erisaVestingFloors && (
        <>
          <div className="section-head">
        Vesting by Contribution Source
        <SectionTip heading="Vesting by Contribution Source" />
      </div>
          <div className="inline-alert" style={{ marginBottom: 14 }}>
            Elective deferrals, rollovers, QNECs and QMACs are always 100% vested and cannot carry a
            schedule. Safe harbor non-elective and basic or enhanced matching contributions must also
            vest immediately; only QACA safe harbor money may use a two-year cliff.
          </div>
          <div className="form-grid">
            <FormField name="matchVesting" label="Matching Contributions" error={errors.matchVesting}
              hint="Leave blank to use the plan schedule above.">
              <select {...register("matchVesting", optionalEnumField)}>
                <option value="">Same as plan schedule</option>
                <option value="imm">Immediate — 100% vested</option>
                <option value="3cliff">3-year cliff</option>
                <option value="6graded">6-year graded</option>
              </select>
            </FormField>
            <FormField name="nonelectiveVesting" label="Non-Elective / Profit Sharing"
              error={errors.nonelectiveVesting} hint="Leave blank to use the plan schedule above.">
              <select {...register("nonelectiveVesting", optionalEnumField)}>
                <option value="">Same as plan schedule</option>
                <option value="imm">Immediate — 100% vested</option>
                <option value="3cliff">3-year cliff</option>
                <option value="6graded">6-year graded</option>
              </select>
            </FormField>
            <FormField name="safeHarborVesting" label="Safe Harbor Contributions"
              error={errors.safeHarborVesting}
              hint="Must be immediate, except QACA money which may use a two-year cliff.">
              <select {...register("safeHarborVesting", optionalEnumField)}>
                <option value="">Same as plan schedule</option>
                <option value="imm">Immediate — 100% vested</option>
                <option value="2cliff">2-year cliff (QACA only)</option>
              </select>
            </FormField>
          </div>
        </>
      )}

      {/* Governmental and top-hat plans are outside Section 411 entirely — offering
          the graded/cliff floors there would be answering a question the Code
          does not ask of them. */}
      {!profile.erisaVestingFloors && (
        <div className="inline-alert" style={{ marginTop: 18, marginBottom: 4 }}>
          The Section 411 minimum vesting schedules do not apply to a {profile.label} plan.
          {profile.topHatOnly
            ? " Deferred amounts are instead subject to a substantial risk of forfeiture, if any."
            : " Set the schedule the plan document actually adopts."}
        </div>
      )}

      {profile.topHatOnly && (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <FormField name="substantialRiskOfForfeiture" label="Substantial Risk of Forfeiture" required
            colSpan2 error={errors.substantialRiskOfForfeiture}
            hint="Amounts subject to a substantial risk of forfeiture are not yet taxable to the participant.">
            <select {...register("substantialRiskOfForfeiture", optionalEnumField)}>
              <option value="">Select…</option>
              <option value="none">None — amounts are fully vested when deferred</option>
              <option value="service">Continued service through a stated date</option>
              <option value="performance">Attainment of stated performance conditions</option>
            </select>
          </FormField>
        </div>
      )}

      <div className="section-head">
        Normal Retirement Age
        <SectionTip heading="Normal Retirement Age" />
      </div>
      <div className="form-grid">
        <FormField name="normalRetirementAge"
          label="NRA"
          required
          error={errors.normalRetirementAge}
          hint="Cannot exceed age 65. 100% vesting is automatic at NRA."
        >
          <select {...register("normalRetirementAge")}>
            <option value="60">Age 60</option>
            <option value="62">Age 62</option>
            <option value="65">Age 65</option>
            <option value="sscra">Social Security retirement age</option>
          </select>
        </FormField>
        <FormField name="vestingOnDeathDisability" label="100% Vesting on Death / Disability" required error={errors.vestingOnDeathDisability}>
          <select {...register("vestingOnDeathDisability")}>
            <option value="both">Both death and disability</option>
            <option value="death">Death only</option>
            <option value="disability">Disability only</option>
            <option value="none">Neither — schedule applies</option>
          </select>
        </FormField>
      </div>

      <FormErrorSummary errors={errors} submitError={submitError} />

      <div className="panel-actions">
        <button type="button" className="btn-back" onClick={() => navigate(`/onboarding/${planId}/step/eligibility`)}>
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
