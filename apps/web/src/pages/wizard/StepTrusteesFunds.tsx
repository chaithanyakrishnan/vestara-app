import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { buildTrusteesFundsSchema, type TrusteesFundsStepInput,
  normalizeStepForPlanType,
} from "@vestara/shared";
import { usePlan } from "../../hooks/usePlan";
import { usePlanProfile, usePlanType, usePlanTypeResolver } from "../../hooks/usePlanTypeForm";
import { useUpdateStep, isApiValidationError } from "../../hooks/useUpdateStep";
import { api } from "../../lib/apiClient";
import { FormField } from "../../components/FormField";
import { SectionTip } from "../../components/InfoTip";
import { FormErrorSummary } from "../../components/FormErrorSummary";
import { OptionCard, OptionGrid } from "../../components/OptionCard";
import { AiSectionBanner } from "../../components/AiSectionBanner";
import { AiProvenanceProvider } from "../../components/AiProvenance";
import { AffixInput } from "../../components/AffixInput";
import { numericField } from "../../lib/forms";
import { ALL_FUNDS, MIN_CORE_FUNDS } from "../../data/funds";

const defaults: TrusteesFundsStepInput = {
  trustees: [{ name: "", type: "Individual" }],
  trusteeType: "disc",
  selectedFundTickers: ["VTSAX", "VTIAX", "VBTLX"],
  qdia: "target",
};

export function StepTrusteesFunds() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan } = usePlan(planId);
  const planType = usePlanType(plan);
  const profile = usePlanProfile(plan);
  const updateStep = useUpdateStep(planId, "trustees_funds");
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
  } = useForm<TrusteesFundsStepInput>({
    resolver: usePlanTypeResolver<TrusteesFundsStepInput>(buildTrusteesFundsSchema, planType),
    defaultValues: defaults,
  });

  const { fields, append, remove } = useFieldArray({ control, name: "trustees" });

  useEffect(() => {
    const existing = plan?.stepData?.find((s: any) => s.stepKey === "trustees_funds")?.data;
    // The normalized PlanTrustee table is the source of truth for trustees when
    // it has rows — an AI extraction writes there even when the step payload is
    // absent, so prefer it over the step data.
    const normalized = plan?.trustees?.length
      ? plan.trustees.map((t: any) => ({ id: t.id, name: t.name, type: t.type }))
      : undefined;

    // Normalized unconditionally: a 403(b) or an unfunded 457(b) must not carry
    // trustees into a step that no longer renders the trustee block.
    reset(
      normalizeStepForPlanType(
        "trustees_funds",
        {
          ...defaults,
          ...(existing ?? {}),
          ...(normalized ? { trustees: normalized } : {}),
        },
        planType,
      ) as any,
    );
  }, [plan, planType, reset]);

  const trusteeType = watch("trusteeType");
  const planAdministratorIsEmployer = watch("planAdministratorIsEmployer");
  const claims404c = watch("claims404c");
  const selectedTickers = watch("selectedFundTickers") ?? [];

  function toggleFund(ticker: string) {
    const selected = selectedTickers.includes(ticker);
    // The three-fund floor is a condition of CLAIMING Section 404(c), not a rule of
    // plan design — a managed-account or single-CIT lineup is legitimate when
    // the relief is not claimed. Only block deselection when it is.
    if (selected && claims404c && selectedTickers.length <= MIN_CORE_FUNDS) return;
    if (selected && selectedTickers.length <= 1) return; // at least one option always
    setValue(
      "selectedFundTickers",
      selected ? selectedTickers.filter((t) => t !== ticker) : [...selectedTickers, ticker],
      { shouldValidate: true, shouldDirty: true },
    );
  }

  async function onSubmit(data: TrusteesFundsStepInput) {
    setSubmitError(null);
    try {
      // Trustees live in BOTH places: the step payload (what hydrates this form)
      // and the normalized PlanTrustee table (what validateReadyToSubmit reads
      // at submission). Write the table first so a failure there stops us before
      // the step is marked complete.
      await api.put(`/plans/${planId}/trustees`, {
        trustees: data.trustees.map((t) => ({ name: t.name, type: t.type })),
      });
      await updateStep.mutateAsync(data);
      navigate(`/onboarding/${planId}/review`);
    } catch (err) {
      if (isApiValidationError(err)) {
        err.issues!.forEach((issue) =>
          setError(issue.path as keyof TrusteesFundsStepInput, { message: issue.message }),
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
    <AiProvenanceProvider plan={plan} stepKey="trustees_funds">
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="panel-eyebrow">Step 6 of 7</div>
      <div className="panel-title">Trustees &amp; Fund Lineup</div>
      <div className="panel-desc">
        The trustee holds plan assets and is named in the trust agreement. Your fund lineup defines what
        participants can invest in.
      </div>

      <AiSectionBanner plan={plan} stepKey="trustees_funds" />

      {/* ── Who holds the assets ────────────────────────────────
          A 403(b) holds custodial accounts or annuity contracts under a
          custodian; a non-governmental 457(b) must remain UNFUNDED, so
          appointing a trustee for participants' benefit would forfeit its
          treatment. Only a trusteed plan sees the trustee block. */}
      {profile.fundingVehicle === "custodial_annuity" && (
        <>
          <div className="section-head">
        Custodian &amp; Investment Providers
        <SectionTip heading="Custodian & Investment Providers" />
      </div>
          <div className="inline-alert" style={{ marginBottom: 14 }}>
            A 403(b) has no trustee. Assets are held in Section 403(b)(7) custodial accounts or
            Section 403(b)(1) annuity contracts.
          </div>
          <div className="form-grid">
            <FormField name="custodianName" label="Custodian or Annuity Issuer" required colSpan2
              error={errors.custodianName}>
              <input {...register("custodianName")} placeholder="e.g. Fidelity Investments Institutional Operations Co." />
            </FormField>
          </div>
        </>
      )}

      {profile.fundingVehicle === "unfunded" && (
        <>
          <div className="section-head">
        Funding
        <SectionTip heading="Funding" />
      </div>
          <div className="inline-alert warn" style={{ marginBottom: 14 }}>
            A non-governmental 457(b) is unfunded by law. Amounts deferred remain the employer's
            property and subject to its general creditors until distributed — no trust may be
            established for participants' benefit, and no trustee is appointed.
          </div>
        </>
      )}

      {/* ── Trustees ──────────────────────────────────────── */}
      {profile.requiresTrustee && (
      <>
      <div className="section-head">
        Plan Trustees
        <SectionTip heading="Plan Trustees" />
      </div>
      {errors.trustees?.message && (
        <div className="inline-alert error" style={{ marginBottom: 12 }}>{errors.trustees.message}</div>
      )}
      <div className="trustee-list">
        {fields.map((field, i) => (
          <div className="trustee-item" key={field.id}>
            <div className="t-name">
              <input
                placeholder="Trustee full name"
                {...register(`trustees.${i}.name` as const)}
                className={errors.trustees?.[i]?.name ? "error-field" : undefined}
              />
            </div>
            <div className="t-type">
              <select {...register(`trustees.${i}.type` as const)}>
                <option value="Individual">Individual</option>
                <option value="Corporate">Corporate</option>
              </select>
            </div>
            <button
              type="button"
              className="t-remove"
              aria-label={`Remove trustee ${i + 1}`}
              onClick={() => remove(i)}
              disabled={fields.length <= 1}
              title={fields.length <= 1 ? "At least one trustee is required" : "Remove"}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {errors.trustees?.[0]?.name && (
        <div className="field-error" style={{ marginBottom: 10 }}>{errors.trustees[0]?.name?.message}</div>
      )}
      <button type="button" className="add-btn" onClick={() => append({ name: "", type: "Individual" })}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Trustee
      </button>

      <div className="section-head" style={{ marginTop: 28 }}>
        Trustee Type
        <SectionTip heading="Trustee Type" />
      </div>
      <OptionGrid cols={2}>
        <OptionCard
          selected={trusteeType === "disc"}
          onSelect={() => setValue("trusteeType", "disc", { shouldValidate: true, shouldDirty: true })}
          title="Discretionary Trustee"
          desc="Trustee has investment authority over plan assets. Common for individual trustees."
        />
        <OptionCard
          selected={trusteeType === "dir"}
          onSelect={() => setValue("trusteeType", "dir", { shouldValidate: true, shouldDirty: true })}
          title="Directed (Non-Discretionary)"
          desc="Trustee follows participant and employer instructions. Common with corporate trustees."
        />
      </OptionGrid>
      </>
      )}

      {/* ── Fund lineup ───────────────────────────────────── */}
      <div className="section-head" style={{ marginTop: 28 }}>
        Core Fund Lineup
        <SectionTip heading="Core Fund Lineup" />
      </div>
      <div className="inline-alert info" style={{ marginBottom: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        {claims404c
          ? `Claiming Section 404(c) requires a broad range — at least ${MIN_CORE_FUNDS} diversified options with materially different risk and return characteristics — plus a QDIA.`
          : "Select the investment options participants may choose from. A QDIA receives contributions for participants who make no election."}
        {" "}Currently selected: {selectedTickers.length}.
      </div>
      {errors.selectedFundTickers?.message && (
        <div className="inline-alert error" style={{ marginBottom: 12 }}>{errors.selectedFundTickers.message}</div>
      )}
      <div className="fund-grid">
        {ALL_FUNDS.map((f) => {
          const selected = selectedTickers.includes(f.ticker);
          const atFloor = selected && claims404c && selectedTickers.length <= MIN_CORE_FUNDS;
          return (
            <OptionCard
              key={f.ticker}
              selected={selected}
              onSelect={() => toggleFund(f.ticker)}
              title={
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="fund-ticker">{f.ticker}</span>
                  <span className="fund-type">{f.type}</span>
                </span>
              }
              desc={
                <>
                  {f.name}
                  {atFloor && (
                    <span style={{ color: "var(--amber)" }}> · minimum {MIN_CORE_FUNDS} for Section 404(c)</span>
                  )}
                </>
              }
            />
          );
        })}
      </div>

      <div className="form-grid">
        <FormField name="qdia"
          label="QDIA — Qualified Default Investment Alternative"
          colSpan2
          required
          error={errors.qdia}
          hint="The default investment when a participant makes no fund election."
        >
          <select {...register("qdia")}>
            <option value="target">Target-Date Fund Suite</option>
            <option value="balanced">Balanced / Lifecycle Fund</option>
            <option value="managed">Managed Account</option>
          </select>
        </FormField>
      </div>

      {/* ── Section 404(c) ─────────────────────────────────────────────
          404(c) is OPTIONAL RELIEF, not a requirement, and the regulation asks
          for a broad range — at least three diversified alternatives with
          materially different risk and return characteristics — not a count.
          The old copy asserted it as a requirement and gated on the count. */}
      {profile.erisa404cAvailable && (
        <>
          <div className="section-head" style={{ marginTop: 28 }}>
            ERISA Section 404(c) <span className="section-badge">Optional relief</span>
          </div>
          <label className="checkbox-row">
            <input type="checkbox" {...register("claims404c")} />
            <span>
              The plan intends to comply with ERISA Section 404(c), relieving fiduciaries of liability for
              participants' own investment decisions.
            </span>
          </label>
          {errors.claims404c && (
            <div className="inline-alert error" style={{ marginTop: 8 }}>{errors.claims404c.message}</div>
          )}
          <div className="inline-alert" style={{ marginTop: 10 }}>
            Claiming Section 404(c) requires a broad range of alternatives — at least three diversified
            options with materially different risk and return characteristics
            (29 CFR 2550.404c-1(b)(3)) — plus the associated participant disclosures.
          </div>
        </>
      )}

      {/* ── Fiduciary appointments (ERISA Section 402(a), Section 3(16)) ──────
          Required entries on Form 5500 and in the SPD. Previously captured
          nowhere: the wizard recorded the ADVISOR's 3(21)/3(38) status, which
          is a different thing from the plan's own appointments. */}
      {profile.files5500 && (
        <>
          <div className="section-head" style={{ marginTop: 28 }}>
        Fiduciary Appointments
        <SectionTip heading="Fiduciary Appointments" />
      </div>
          <label className="checkbox-row" style={{ marginBottom: 10 }}>
            <input type="checkbox" {...register("planAdministratorIsEmployer")} />
            <span>The employer serves as plan administrator (most common).</span>
          </label>
          <div className="form-grid">
            {!planAdministratorIsEmployer && (
              <FormField name="planAdministratorName" label="Plan Administrator" required colSpan2
                error={errors.planAdministratorName} hint="ERISA Section 3(16). Named on Form 5500 and in the SPD.">
                <input {...register("planAdministratorName")} placeholder="e.g. Pinnacle 3(16) Fiduciary Services, LLC" />
              </FormField>
            )}
            <FormField name="namedFiduciary" label="Named Fiduciary" required error={errors.namedFiduciary}
              hint="ERISA Section 402(a) requires at least one fiduciary with authority to control the plan.">
              <input {...register("namedFiduciary")} placeholder="e.g. The Board of Directors of the Employer" />
            </FormField>
            <FormField name="agentForServiceOfProcess" label="Agent for Service of Legal Process"
              error={errors.agentForServiceOfProcess} hint="Disclosed in the SPD. Defaults to the plan administrator if blank.">
              <input {...register("agentForServiceOfProcess")} placeholder="Name and address" />
            </FormField>
          </div>

          <div className="section-head" style={{ marginTop: 28 }}>
            Fidelity Bond <span className="section-badge">ERISA Section 412</span>
          </div>
          <div className="inline-alert" style={{ marginBottom: 14 }}>
            Everyone who handles plan funds must be bonded for 10% of the funds handled — at least
            $1,000 and at most $500,000, or $1,000,000 if the plan holds employer securities.
            An unbonded plan is a standard DOL audit finding.
          </div>
          <div className="form-grid">
            <FormField name="fidelityBondCarrier" label="Bond Carrier" error={errors.fidelityBondCarrier}>
              <input {...register("fidelityBondCarrier")} placeholder="e.g. Travelers Casualty and Surety" />
            </FormField>
            <FormField name="fidelityBondAmount" label="Bond Amount" required error={errors.fidelityBondAmount}>
              <AffixInput prefix="$" registration={register("fidelityBondAmount", numericField)}
                type="number" step="1000" placeholder="50000" />
            </FormField>
          </div>
        </>
      )}

      <FormErrorSummary errors={errors} submitError={submitError} />

      <div className="panel-actions">
        <button type="button" className="btn-back" onClick={() => navigate(`/onboarding/${planId}/step/administration`)}>
          ← Back
        </button>
        <button className="btn-primary" type="submit" disabled={updateStep.isPending}>
          {updateStep.isPending ? "Saving…" : "Continue to Review"}
        </button>
      </div>
    </form>
    </AiProvenanceProvider>
  );
}
