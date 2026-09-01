import { useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { TrusteesFundsStepSchema, type TrusteesFundsStepInput } from "@vestara/shared";
import { usePlan } from "../../hooks/usePlan";
import { useUpdateStep, isApiValidationError } from "../../hooks/useUpdateStep";
import { api } from "../../lib/apiClient";
import { FormField } from "../../components/FormField";
import { FormErrorSummary } from "../../components/FormErrorSummary";
import { OptionCard, OptionGrid } from "../../components/OptionCard";
import { AiSectionBanner } from "../../components/AiSectionBanner";
import { AiProvenanceProvider } from "../../components/AiProvenance";
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
  const updateStep = useUpdateStep(planId, "trustees_funds");

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
    resolver: zodResolver(TrusteesFundsStepSchema),
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

    if (existing || normalized) {
      reset({
        ...defaults,
        ...(existing ?? {}),
        ...(normalized ? { trustees: normalized } : {}),
      });
    }
  }, [plan, reset]);

  const trusteeType = watch("trusteeType");
  const selectedTickers = watch("selectedFundTickers") ?? [];

  function toggleFund(ticker: string) {
    const selected = selectedTickers.includes(ticker);
    if (selected && selectedTickers.length <= MIN_CORE_FUNDS) return; // floor enforced by schema too
    setValue(
      "selectedFundTickers",
      selected ? selectedTickers.filter((t) => t !== ticker) : [...selectedTickers, ticker],
      { shouldValidate: true, shouldDirty: true },
    );
  }

  async function onSubmit(data: TrusteesFundsStepInput) {
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

      {/* ── Trustees ──────────────────────────────────────── */}
      <div className="section-head">Plan Trustees</div>
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

      <div className="section-head" style={{ marginTop: 28 }}>Trustee Type</div>
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

      {/* ── Fund lineup ───────────────────────────────────── */}
      <div className="section-head" style={{ marginTop: 28 }}>Core Fund Lineup</div>
      <div className="inline-alert info" style={{ marginBottom: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        ERISA §404(c) protection requires at least {MIN_CORE_FUNDS} diversified core options and a QDIA.
        {" "}Currently selected: {selectedTickers.length}.
      </div>
      {errors.selectedFundTickers?.message && (
        <div className="inline-alert error" style={{ marginBottom: 12 }}>{errors.selectedFundTickers.message}</div>
      )}
      <div className="fund-grid">
        {ALL_FUNDS.map((f) => {
          const selected = selectedTickers.includes(f.ticker);
          const atFloor = selected && selectedTickers.length <= MIN_CORE_FUNDS;
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
                    <span style={{ color: "var(--amber)" }}> · minimum {MIN_CORE_FUNDS} required</span>
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

      <FormErrorSummary errors={errors} />

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
