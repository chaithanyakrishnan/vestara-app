import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { ContributionsStepSchema, type ContributionsStepInput } from "@vestara/shared";
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

const defaults: ContributionsStepInput = {
  pretaxDeferrals: true,
  rothDeferrals: false,
  catchupPermitted: "yes",
  catchupMatched: "no",
  safeHarborElected: false,
  matchElected: false,
  nonelectiveElected: false,
  forfeitureUse: "reduce_ne",
};

const SAFE_HARBOR_FORMULAS = [
  { value: "basic", title: "Basic Match", formula: "100% on first 3% + 50% on next 2%", desc: "Most common. Employer matches up to 4% of comp." },
  { value: "enhanced", title: "Enhanced Match", formula: "≥ Basic Match formula", desc: "Any formula at least as generous as the basic match." },
  { value: "ne", title: "Nonelective 3%", formula: "3% of comp — all eligible employees", desc: "Goes to all eligible participants whether or not they defer." },
  { value: "qaca", title: "QACA Basic Match", formula: "100% on 1% + 50% on 1%–6%", desc: "Required with a Qualified Automatic Contribution Arrangement." },
] as const;

const FORFEITURE_USES = [
  { value: "reduce_ne", title: "Reduce Nonelective", desc: "Applied against future nonelective contributions." },
  { value: "reduce_match", title: "Reduce Match", desc: "Applied against future matching contributions." },
  { value: "pay_expenses", title: "Pay Plan Expenses", desc: "Pays reasonable plan expenses first, then reduces contributions." },
  { value: "reallocate", title: "Reallocate", desc: "Reallocated among remaining participants." },
] as const;

export function StepContributions() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan } = usePlan(planId);
  const updateStep = useUpdateStep(planId, "contributions");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ContributionsStepInput>({
    resolver: zodResolver(ContributionsStepSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    const existing = plan?.stepData?.find((s: any) => s.stepKey === "contributions")?.data;
    if (existing) reset({ ...defaults, ...existing });
  }, [plan, reset]);

  const pretax = watch("pretaxDeferrals");
  const roth = watch("rothDeferrals");
  const safeHarborElected = watch("safeHarborElected");
  const safeHarborType = watch("safeHarborType");
  const matchElected = watch("matchElected");
  const matchType = watch("matchType");
  const nonelectiveElected = watch("nonelectiveElected");
  const nonelectiveType = watch("nonelectiveType");
  const forfeitureUse = watch("forfeitureUse");

  // These fields are registered but only rendered inside a reveal, so RHF needs
  // them declared up front for setValue to reach them.
  useEffect(() => {
    register("pretaxDeferrals");
    register("rothDeferrals");
    register("safeHarborType", optionalEnumField);
    register("matchType", optionalEnumField);
    register("nonelectiveType", optionalEnumField);
    register("forfeitureUse");
  }, [register]);

  const pick = makeFieldSetter<ContributionsStepInput>(setValue);

  async function onSubmit(data: ContributionsStepInput) {
    try {
      await updateStep.mutateAsync(data);
      navigate(`/onboarding/${planId}/step/eligibility`);
    } catch (err) {
      if (isApiValidationError(err)) {
        err.issues!.forEach((issue) =>
          setError(issue.path as keyof ContributionsStepInput, { message: issue.message }),
        );
      }
    }
  }

  return (
    <AiProvenanceProvider plan={plan} stepKey="contributions">
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="panel-eyebrow">Step 2 of 7</div>
      <div className="panel-title">Contributions &amp; Safe Harbor</div>
      <div className="panel-desc">
        Select which contribution types the plan will accept. At least one elective deferral type must be
        elected. Safe Harbor elections affect ADP/ACP testing obligations.
      </div>

      <AiSectionBanner plan={plan} stepKey="contributions" />

      {/* ── Elective Deferrals ─────────────────────────────── */}
      <div className="section-head">Elective Deferrals</div>
      {errors.pretaxDeferrals && (
        <div className="inline-alert error" style={{ marginBottom: 12 }}>{errors.pretaxDeferrals.message}</div>
      )}
      <OptionGrid cols={2}>
        <OptionCard
          checkable
          selected={!!pretax}
          onSelect={() => pick("pretaxDeferrals", !pretax)}
          title="Pre-Tax Deferrals"
          desc="Traditional 401(k). Reduces taxable income now, taxed at withdrawal."
        />
        <OptionCard
          checkable
          selected={!!roth}
          onSelect={() => pick("rothDeferrals", !roth)}
          title={
            <>
              Roth Deferrals
              <span className="req-badge amber">Required for high earners in 2026</span>
            </>
          }
          desc="After-tax contributions; qualified withdrawals are tax-free. Earners above $150K FICA wages must make catch-up contributions as Roth beginning 2026."
        />
      </OptionGrid>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <FormField name="catchupPermitted" label="Catch-Up Deferrals (age 50+)" error={errors.catchupPermitted}>
          <select {...register("catchupPermitted", optionalEnumField)}>
            <option value="yes">Permitted — standard $7,500 limit</option>
            <option value="no">Not permitted</option>
          </select>
        </FormField>
        <FormField name="catchupMatched" label="Catch-Up Matched by Employer" error={errors.catchupMatched}>
          <select {...register("catchupMatched", optionalEnumField)}>
            <option value="no">No — match excludes catch-up</option>
            <option value="yes">Yes — match applies to catch-up</option>
          </select>
        </FormField>
      </div>

      {/* ── Safe Harbor ────────────────────────────────────── */}
      <div className="section-head">
        Safe Harbor <span className="section-badge">Affects ADP/ACP testing</span>
      </div>
      <ToggleRow
        checked={!!safeHarborElected}
        onChange={(next) => {
          pick("safeHarborElected", next);
          // Dependents are not stripped by the schema — clear them ourselves so
          // a de-elected safe harbor doesn't persist a stale formula.
          if (!next) {
            pick("safeHarborType", undefined);
            pick("safeHarborPeriod", undefined);
            pick("safeHarborAppliesTo", undefined);
          } else if (!safeHarborType) {
            setValue("safeHarborType", "basic");
          }
        }}
        label="Safe Harbor Plan"
        sub="Automatically satisfies ADP/ACP testing. Requires 100% immediately vested employer contributions."
      />
      <RevealSection open={!!safeHarborElected}>
        <div style={{ paddingTop: 16 }}>
          {errors.safeHarborType && (
            <div className="inline-alert error" style={{ marginBottom: 12 }}>{errors.safeHarborType.message}</div>
          )}
          <OptionGrid cols={2}>
            {SAFE_HARBOR_FORMULAS.map((f) => (
              <OptionCard
                key={f.value}
                selected={safeHarborType === f.value}
                onSelect={() => pick("safeHarborType", f.value)}
                title={f.title}
                formula={f.formula}
                desc={f.desc}
              />
            ))}
          </OptionGrid>
          <div className="form-grid" style={{ marginTop: 16 }}>
            <FormField name="safeHarborPeriod" label="Computation Period" error={errors.safeHarborPeriod}>
              <select {...register("safeHarborPeriod", optionalEnumField)}>
                <option value="payroll">Each payroll period</option>
                <option value="monthly">Each month</option>
                <option value="annual">Plan year (true-up)</option>
              </select>
            </FormField>
            <FormField name="safeHarborAppliesTo" label="Applies To" error={errors.safeHarborAppliesTo}>
              <select {...register("safeHarborAppliesTo")}>
                <option value="All eligible participants">All eligible participants</option>
                <option value="NHCEs only">NHCEs only</option>
              </select>
            </FormField>
          </div>
        </div>
      </RevealSection>

      {/* ── Employer Match ─────────────────────────────────── */}
      <div className="section-head">Employer Match</div>
      <ToggleRow
        checked={!!matchElected}
        onChange={(next) => {
          pick("matchElected", next);
          if (!next) {
            pick("matchType", undefined);
            pick("matchPct", undefined);
            pick("matchCapPct", undefined);
          } else if (!matchType) {
            setValue("matchType", "disc");
          }
        }}
        label="Discretionary or Fixed Match"
        sub="An employer match separate from any safe harbor match elected above."
      />
      <RevealSection open={!!matchElected}>
        <div style={{ paddingTop: 16 }}>
          <OptionGrid cols={2}>
            <OptionCard
              selected={matchType === "disc"}
              onSelect={() => pick("matchType", "disc")}
              title="Discretionary"
              desc="Employer decides the match each year. No fixed obligation."
            />
            <OptionCard
              selected={matchType === "fixed"}
              onSelect={() => pick("matchType", "fixed")}
              title="Fixed Percentage"
              desc="A stated match rate applied every plan year."
            />
          </OptionGrid>
          <RevealSection open={matchType === "fixed"}>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <FormField name="matchPct" label="Match Rate" required error={errors.matchPct} hint="e.g. 50 means $0.50 per $1 deferred.">
                <AffixInput
                  registration={register("matchPct", numericField)}
                  suffix="%"
                  type="number"
                  step="1"
                  min={0}
                  max={100}
                  placeholder="50"
                />
              </FormField>
              <FormField name="matchCapPct" label="Capped at Deferral %" error={errors.matchCapPct} hint="Match applies up to this share of compensation.">
                <AffixInput
                  registration={register("matchCapPct", numericField)}
                  suffix="%"
                  type="number"
                  step="0.5"
                  min={0}
                  max={25}
                  placeholder="6"
                />
              </FormField>
            </div>
          </RevealSection>
        </div>
      </RevealSection>

      {/* ── Nonelective / Profit Sharing ───────────────────── */}
      <div className="section-head">Nonelective / Profit Sharing</div>
      <ToggleRow
        checked={!!nonelectiveElected}
        onChange={(next) => {
          pick("nonelectiveElected", next);
          if (!next) {
            pick("nonelectiveType", undefined);
            pick("nonelectivePct", undefined);
            pick("nonelectiveAllocation", undefined);
            pick("nonelectiveCondition", undefined);
          } else if (!nonelectiveType) {
            setValue("nonelectiveType", "disc");
          }
        }}
        label="Nonelective / Profit Sharing Contribution"
        sub="Employer contribution not tied to participant deferrals."
      />
      <RevealSection open={!!nonelectiveElected}>
        <div style={{ paddingTop: 16 }}>
          <OptionGrid cols={2}>
            <OptionCard
              selected={nonelectiveType === "disc"}
              onSelect={() => pick("nonelectiveType", "disc")}
              title="Discretionary"
              desc="Employer decides the amount each year. No fixed obligation."
            />
            <OptionCard
              selected={nonelectiveType === "fixed"}
              onSelect={() => pick("nonelectiveType", "fixed")}
              title="Fixed Percentage"
              desc="A fixed % of compensation contributed each plan year."
            />
          </OptionGrid>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <RevealSection open={nonelectiveType === "fixed"}>
              <FormField name="nonelectivePct" label="Fixed NE Percentage" required error={errors.nonelectivePct}>
                <AffixInput
                  registration={register("nonelectivePct", numericField)}
                  suffix="%"
                  type="number"
                  step="0.5"
                  min={0}
                  max={25}
                  placeholder="3"
                />
              </FormField>
            </RevealSection>
            <FormField name="nonelectiveAllocation" label="Allocation Method" error={errors.nonelectiveAllocation}>
              <select {...register("nonelectiveAllocation", optionalEnumField)}>
                <option value="prorata">Pro rata (uniform % of comp)</option>
                <option value="integrated">Integrated with Social Security</option>
                <option value="grouped">Cross-testing / classifications</option>
              </select>
            </FormField>
            <FormField name="nonelectiveCondition"
              label="Allocation Condition"
              colSpan2
              error={errors.nonelectiveCondition}
              hint="Most plans require employment on the last day of the plan year."
            >
              <select {...register("nonelectiveCondition", optionalEnumField)}>
                <option value="lastday">Last day of plan year (employed on 12/31)</option>
                <option value="1000hrs">1,000 hours + employment</option>
                <option value="none">No condition</option>
              </select>
            </FormField>
          </div>
        </div>
      </RevealSection>

      {/* ── Forfeitures ────────────────────────────────────── */}
      <div className="section-head">Forfeiture Use</div>
      {errors.forfeitureUse && (
        <div className="inline-alert error" style={{ marginBottom: 12 }}>{errors.forfeitureUse.message}</div>
      )}
      <OptionGrid cols={2}>
        {FORFEITURE_USES.map((f) => (
          <OptionCard
            key={f.value}
            selected={forfeitureUse === f.value}
            onSelect={() => pick("forfeitureUse", f.value)}
            title={f.title}
            desc={f.desc}
          />
        ))}
      </OptionGrid>

      <FormErrorSummary errors={errors} />

      <div className="panel-actions">
        <button type="button" className="btn-back" onClick={() => navigate(`/onboarding/${planId}/step/identity`)}>
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
