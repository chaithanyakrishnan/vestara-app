import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { buildContributionsSchema, IRS_LIMITS, type ContributionsStepInput,
  normalizeStepForPlanType,
  SAFE_HARBOR_DEFAULT_RATES,
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

const defaults: ContributionsStepInput = {
  pretaxDeferrals: true,
  rothDeferrals: true,
  catchupPermitted: "yes",
  catchupMatched: "no",
  safeHarborElected: false,
  matchElected: false,
  nonelectiveElected: false,
  forfeitureUse: "reduce_ne",
  // W-2 is the definition the large majority of plans adopt; it is a visible
  // select, so this is a starting point rather than a decision made for them.
  compensationDefinition: "w2",
  compensationPostSeverance: "include",
  compensationExclusions: [],
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

const COMP_EXCLUSIONS = [
  { value: "bonus", label: "Bonuses", desc: "Annual, spot and retention bonuses are left out of plan compensation." },
  { value: "overtime", label: "Overtime", desc: "Premium pay above base hours is excluded. Common where overtime is uneven." },
  { value: "commissions", label: "Commissions", desc: "Sales commissions are excluded. Often paired with an excluded bonus." },
  { value: "fringe", label: "Fringe Benefits", desc: "Taxable fringes — car allowance, moving expenses, imputed income." },
  { value: "severance", label: "Severance Pay", desc: "Post-employment severance is excluded. Separate from post-severance regular pay." },
] as const;

type CompExclusion = (typeof COMP_EXCLUSIONS)[number]["value"];

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
  const planType = usePlanType(plan);
  const profile = usePlanProfile(plan);
  const updateStep = useUpdateStep(planId, "contributions");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ContributionsStepInput>({
    resolver: usePlanTypeResolver<ContributionsStepInput>(buildContributionsSchema, planType),
    defaultValues: defaults,
  });

  useEffect(() => {
    const existing = plan?.stepData?.find((s: any) => s.stepKey === "contributions")?.data;
    // Always normalize — including when there is no saved data yet. The
    // `defaults` above are 401(k)-shaped, and carrying (say) catchupPermitted
    // "yes" into a 401(a) leaves an invalid value in a field that is no longer
    // rendered, which shows up to the user as a Continue button that does
    // nothing at all.
    reset(normalizeStepForPlanType("contributions", { ...defaults, ...(existing ?? {}) }, planType) as any);
  }, [plan, planType, reset]);

  const pretax = watch("pretaxDeferrals");
  const roth = watch("rothDeferrals");
  const safeHarborElected = watch("safeHarborElected");
  const safeHarborType = watch("safeHarborType");
  const matchElected = watch("matchElected");
  const matchType = watch("matchType");
  const nonelectiveElected = watch("nonelectiveElected");
  const nonelectiveType = watch("nonelectiveType");
  const forfeitureUse = watch("forfeitureUse");
  const compensationExclusions = watch("compensationExclusions");

  // Array field: RHF holds it whole, so toggling means rewriting the array.
  const toggleCompExclusion = (value: CompExclusion) => {
    const current = (compensationExclusions ?? []) as CompExclusion[];
    pick(
      "compensationExclusions",
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    );
  };

  // These fields are registered but only rendered inside a reveal, so RHF needs
  // them declared up front for setValue to reach them.
  useEffect(() => {
    register("pretaxDeferrals");
    register("rothDeferrals");
    register("safeHarborType", optionalEnumField);
    register("matchType", optionalEnumField);
    register("nonelectiveType", optionalEnumField);
    register("forfeitureUse");
    register("compensationExclusions");
  }, [register]);

  const pick = makeFieldSetter<ContributionsStepInput>(setValue);

  async function onSubmit(data: ContributionsStepInput) {
    setSubmitError(null);
    try {
      await updateStep.mutateAsync(data);
      navigate(`/onboarding/${planId}/step/eligibility`);
    } catch (err) {
      if (isApiValidationError(err)) {
        err.issues!.forEach((issue) =>
          setError(issue.path as keyof ContributionsStepInput, { message: issue.message }),
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
    <AiProvenanceProvider plan={plan} stepKey="contributions">
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="panel-eyebrow">Step 2 of 7</div>
      <div className="panel-title">Contributions &amp; Safe Harbor</div>
      <div className="panel-desc">
        Select which contribution types the plan will accept. At least one elective deferral type must be
        elected. Safe Harbor elections affect ADP/ACP testing obligations.
      </div>

      <AiSectionBanner plan={plan} stepKey="contributions" />

      {/* ── Elective Deferrals ─────────────────────────────────
          A 401(a) has no deferral feature at all — employer money is the only
          money — so the whole block is absent rather than disabled. */}
      {!profile.electiveDeferrals && (
        <div className="inline-alert" style={{ marginBottom: 16 }}>
          A {profile.label} plan is funded entirely by the employer. There is no employee
          elective deferral feature and no Section 402(g) limit — elect a match or a non-elective
          contribution below.
        </div>
      )}

      {profile.electiveDeferrals && (
      <>
      <div className="section-head">
        Elective Deferrals
        <SectionTip heading="Elective Deferrals" />
      </div>
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
        {/* Section 402A designated Roth is available to 401(k), 403(b) and
            GOVERNMENTAL 457(b) only — never to a non-governmental 457(b). */}
        {profile.rothAvailable && (
          <OptionCard
            checkable
            selected={!!roth}
            onSelect={() => pick("rothDeferrals", !roth)}
            title={
              <>
                Roth Deferrals
                <span className="req-badge amber">Required for high earners</span>
              </>
            }
            desc={`After-tax contributions; qualified withdrawals are tax-free. SECURE 2.0 Section 603: participants with prior-year FICA wages above ${usd(IRS_LIMITS.rothCatchUpWageThreshold)} must make catch-up contributions as Roth.`}
          />
        )}
      </OptionGrid>

      {/* Catch-ups differ by plan type: a non-governmental 457(b) gets no
          age-50 catch-up at all, only the final-three-years one; a 403(b) adds
          the 15-year service catch-up. */}
      <div className="form-grid" style={{ marginTop: 16 }}>
        {profile.availableCatchUps.includes("age50") && (
          <FormField name="catchupPermitted" label="Catch-Up Deferrals (age 50+)" error={errors.catchupPermitted}>
            <select {...register("catchupPermitted", optionalEnumField)}>
              <option value="yes">Permitted — {usd(IRS_LIMITS.catchUp50)} limit</option>
              <option value="no">Not permitted</option>
            </select>
          </FormField>
        )}
        {profile.availableCatchUps.includes("super60to63") && (
          <FormField name="superCatchupPermitted" label="Age 60–63 Super Catch-Up"
            error={errors.superCatchupPermitted}
            hint={`SECURE 2.0 Section 109 — ${usd(IRS_LIMITS.superCatchUp60to63)}.`}>
            <select {...register("superCatchupPermitted", optionalEnumField)}>
              <option value="">Select…</option>
              <option value="yes">Permitted</option>
              <option value="no">Not permitted</option>
            </select>
          </FormField>
        )}
        {profile.availableCatchUps.includes("service15") && (
          <FormField name="service15CatchupPermitted" label="15-Year Service Catch-Up"
            error={errors.service15CatchupPermitted}
            hint="Section 402(g)(7). Qualifying organizations only — schools, hospitals, churches, health and welfare agencies.">
            <select {...register("service15CatchupPermitted", optionalEnumField)}>
              <option value="">Select…</option>
              <option value="yes">Permitted</option>
              <option value="no">Not permitted</option>
            </select>
          </FormField>
        )}
        {profile.availableCatchUps.includes("final3") && (
          <FormField name="final3CatchupPermitted" label="Final Three Years Catch-Up"
            error={errors.final3CatchupPermitted}
            hint="Section 457(b)(3). Can double the annual limit, but cannot be combined with the age-50 catch-up in the same year.">
            <select {...register("final3CatchupPermitted", optionalEnumField)}>
              <option value="">Select…</option>
              <option value="yes">Permitted</option>
              <option value="no">Not permitted</option>
            </select>
          </FormField>
        )}
        <FormField name="catchupMatched" label="Catch-Up Matched by Employer" error={errors.catchupMatched}>
          <select {...register("catchupMatched", optionalEnumField)}>
            <option value="no">No — match excludes catch-up</option>
            <option value="yes">Yes — match applies to catch-up</option>
          </select>
        </FormField>
      </div>

      {profile.combinedEmployeeEmployerLimit && (
        <div className="inline-alert" style={{ marginTop: 12 }}>
          The Section 457(b) annual limit of {usd(IRS_LIMITS.electiveDeferral)} is a single ceiling covering
          employee deferrals <strong>and</strong> employer contributions combined — unlike Section 415(c),
          which counts them separately.
        </div>
      )}
      </>
      )}

      {/* ── Safe Harbor ─────────────────────────────────────────
          ADP/ACP testing is what a safe harbor buys relief from, and only a
          401(k) is subject to it. Hidden entirely for every other type. */}
      {profile.safeHarborAvailable && (
      <>
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
                onSelect={() => {
                  pick("safeHarborType", f.value);
                  // The rate fields are required once a formula is chosen, so
                  // seed the statutory default rather than leaving the user to
                  // discover four empty required inputs.
                  const r = SAFE_HARBOR_DEFAULT_RATES[f.value] ?? {};
                  pick("safeHarborMatchTier1Pct", r.safeHarborMatchTier1Pct);
                  pick("safeHarborMatchTier1UpToPct", r.safeHarborMatchTier1UpToPct);
                  pick("safeHarborMatchTier2Pct", r.safeHarborMatchTier2Pct);
                  pick("safeHarborMatchTier2UpToPct", r.safeHarborMatchTier2UpToPct);
                  pick("safeHarborNonelectivePct", r.safeHarborNonelectivePct);
                }}
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
          {/* The formula itself. Capturing only the safe harbor TYPE meant the
              plan's actual match rates were never recorded, so the document
              could not be drafted from the wizard's output. */}
          <div className="form-grid" style={{ marginTop: 16 }}>
            {(safeHarborType === "ne" || safeHarborType === "qaca") && (
              <FormField name="safeHarborNonelectivePct" label="Non-Elective %" required
                error={errors.safeHarborNonelectivePct} hint="Minimum 3% of compensation.">
                <AffixInput suffix="%" registration={register("safeHarborNonelectivePct", numericField)}
                  type="number" step="0.5" placeholder="3" />
              </FormField>
            )}
            {(safeHarborType === "basic" || safeHarborType === "enhanced") && (
              <>
                <FormField name="safeHarborMatchTier1Pct" label="Tier 1 Match %" required
                  error={errors.safeHarborMatchTier1Pct} hint="Basic: 100% on the first 3%.">
                  <AffixInput suffix="%" registration={register("safeHarborMatchTier1Pct", numericField)}
                    type="number" step="1" placeholder="100" />
                </FormField>
                <FormField name="safeHarborMatchTier1UpToPct" label="Tier 1 Up To Deferral %"
                  error={errors.safeHarborMatchTier1UpToPct}>
                  <AffixInput suffix="%" registration={register("safeHarborMatchTier1UpToPct", numericField)}
                    type="number" step="0.5" placeholder="3" />
                </FormField>
                <FormField name="safeHarborMatchTier2Pct" label="Tier 2 Match %"
                  error={errors.safeHarborMatchTier2Pct} hint="Basic: 50% on the next 2%.">
                  <AffixInput suffix="%" registration={register("safeHarborMatchTier2Pct", numericField)}
                    type="number" step="1" placeholder="50" />
                </FormField>
                <FormField name="safeHarborMatchTier2UpToPct" label="Tier 2 Up To Deferral %"
                  error={errors.safeHarborMatchTier2UpToPct}>
                  <AffixInput suffix="%" registration={register("safeHarborMatchTier2UpToPct", numericField)}
                    type="number" step="0.5" placeholder="5" />
                </FormField>
              </>
            )}
          </div>
        </div>
      </RevealSection>
      </>
      )}

      {/* ── ADP/ACP testing method ──────────────────────────────
          A required adoption-agreement election for any 401(k) that is not a
          safe harbor, and one that cannot be changed freely afterwards. */}
      {profile.adpAcpTesting && !safeHarborElected && (
        <>
          <div className="section-head">
        Nondiscrimination Testing
        <SectionTip heading="Nondiscrimination Testing" />
      </div>
          <div className="form-grid">
            <FormField name="adpTestMethod" label="ADP / ACP Testing Method" required
              error={errors.adpTestMethod}
              hint="Prior-year testing lets you know the NHCE limit in advance; current-year is more flexible but only known after year end.">
              <select {...register("adpTestMethod", optionalEnumField)}>
                <option value="">Select…</option>
                <option value="prior">Prior-year NHCE percentages</option>
                <option value="current">Current-year NHCE percentages</option>
              </select>
            </FormField>
            <FormField name="topHeavyMinimumBy" label="Top-Heavy Minimum Contribution"
              error={errors.topHeavyMinimumBy}
              hint="Section 416 — who funds the 3% minimum in a year the plan is top-heavy.">
              <select {...register("topHeavyMinimumBy", optionalEnumField)}>
                <option value="">Select…</option>
                <option value="employer">Employer funds the top-heavy minimum</option>
                <option value="not_applicable">Not applicable — deemed non-top-heavy</option>
              </select>
            </FormField>
          </div>
        </>
      )}

      {/* ── Employer Match ─────────────────────────────────── */}
      <div className="section-head">
        Employer Match
        <SectionTip heading="Employer Match" />
      </div>
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
      <div className="section-head">
        Nonelective / Profit Sharing
        <SectionTip heading="Nonelective / Profit Sharing" />
      </div>
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

      {/* ── Definition of compensation ──────────────────────────
          Every contribution the plan calculates depends on this, and using the
          wrong definition is the most common operational failure corrected
          under EPCRS. It had no field at all before. */}
      <div className="section-head">
        Definition of Compensation <span className="section-badge">Section 415(c)(3)</span>
      </div>
      <div className="form-grid">
        <FormField name="compensationDefinition" label="Base Definition" required colSpan2
          error={errors.compensationDefinition}>
          <select {...register("compensationDefinition", optionalEnumField)}>
            <option value="">Select…</option>
            <option value="w2">W-2 wages (Box 1, plus deferrals)</option>
            <option value="3401a">Section 3401(a) income tax withholding wages</option>
            <option value="415_safe_harbor">Section 415 safe harbor compensation</option>
          </select>
        </FormField>
        <FormField name="compensationPostSeverance" label="Post-Severance Compensation"
          error={errors.compensationPostSeverance}
          hint="Amounts paid within 2½ months of severance — regular pay, unused leave.">
          <select {...register("compensationPostSeverance", optionalEnumField)}>
            <option value="">Select…</option>
            <option value="include">Include</option>
            <option value="exclude">Exclude</option>
          </select>
        </FormField>
      </div>
      <div className="form-grid" style={{ marginTop: 8 }}>
        <FormField name="compensationExclusions" label="Excluded From Compensation" colSpan2
          error={errors.compensationExclusions as any}
          hint="Each exclusion narrows the pay every contribution is calculated on. Excluding a category can require Section 414(s) testing to show the definition is still nondiscriminatory.">
          {/* Independent yes/no categories, each worth a sentence of
              explanation — the project's OptionCard `checkable` mode, not a
              multi-select, which would hide the consequences behind a list. */}
          <OptionGrid cols={2}>
            {COMP_EXCLUSIONS.map((c) => (
              <OptionCard
                key={c.value}
                checkable
                selected={(compensationExclusions ?? []).includes(c.value)}
                onSelect={() => toggleCompExclusion(c.value)}
                title={c.label}
                desc={c.desc}
              />
            ))}
          </OptionGrid>
        </FormField>
      </div>

      <div className="inline-alert" style={{ marginTop: 12 }}>
        Compensation counted for any participant is capped at {usd(IRS_LIMITS.compensationCap)} under
        Section 401(a)(17), and total annual additions from all sources at {usd(IRS_LIMITS.section415c)} under Section 415(c).
      </div>

      {/* ── Forfeitures ────────────────────────────────────── */}
      <div className="section-head">
        Forfeiture Use
        <SectionTip heading="Forfeiture Use" />
      </div>
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

      <FormErrorSummary errors={errors} submitError={submitError} />

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
