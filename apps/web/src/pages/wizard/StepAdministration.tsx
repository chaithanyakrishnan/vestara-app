import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { AdministrationStepSchema, type AdministrationStepInput } from "@vestara/shared";
import { usePlan } from "../../hooks/usePlan";
import { useUpdateStep, isApiValidationError } from "../../hooks/useUpdateStep";
import { FormField } from "../../components/FormField";
import { FormErrorSummary } from "../../components/FormErrorSummary";
import { OptionCard, OptionGrid } from "../../components/OptionCard";
import { ToggleRow, RevealSection } from "../../components/ToggleRow";
import { AffixInput } from "../../components/AffixInput";
import { AiSectionBanner } from "../../components/AiSectionBanner";
import { AiProvenanceProvider } from "../../components/AiProvenance";
import { BANKS } from "../../data/datalists";
import { makeFieldSetter, numericField, optionalEnumField } from "../../lib/forms";

const defaults: AdministrationStepInput = {
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
  const updateStep = useUpdateStep(planId, "administration");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<AdministrationStepInput>({
    resolver: zodResolver(AdministrationStepSchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    const existing = plan?.stepData?.find((s: any) => s.stepKey === "administration")?.data;
    if (existing) reset({ ...defaults, ...existing });
  }, [plan, reset]);

  const loansPermitted = watch("loansPermitted");
  const inService = watch("inServiceAt59_5");
  const hardshipElected = watch("hardshipElected");
  const hardshipType = watch("hardshipType");
  const rolloversAccepted = watch("rolloversAccepted");
  const planExpensePayer = watch("planExpensePayer");
  const paymentMethod = watch("employerPaymentMethod");

  const pick = makeFieldSetter<AdministrationStepInput>(setValue);

  async function onSubmit(data: AdministrationStepInput) {
    try {
      await updateStep.mutateAsync(data);
      navigate(`/onboarding/${planId}/step/trustees_funds`);
    } catch (err) {
      if (isApiValidationError(err)) {
        err.issues!.forEach((issue) =>
          setError(issue.path as keyof AdministrationStepInput, { message: issue.message }),
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

      {/* ── Loans ─────────────────────────────────────────── */}
      <div className="section-head">Participant Loans</div>
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
                <option value="hardship_only">Restricted purposes only</option>
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

      {/* ── In-service distributions ──────────────────────── */}
      <div className="section-head">In-Service Distributions</div>
      <ToggleRow
        checked={!!inService}
        onChange={(next) => pick("inServiceAt59_5", next)}
        label="Age 59½ In-Service Withdrawals"
        sub="Participants aged 59½ or older may withdraw from any account while still employed."
      />

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
          </div>
        </RevealSection>
      </div>

      {/* ── Rollovers ─────────────────────────────────────── */}
      <div className="section-head">Rollover Contributions</div>
      <ToggleRow
        checked={!!rolloversAccepted}
        onChange={(next) => {
          pick("rolloversAccepted", next);
          setValue("rolloverSources", next ? "all" : "none");
        }}
        label="Accept Rollover Contributions"
        sub="The plan will accept rollovers from qualified plans, IRAs, and 403(b)s."
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
      <div className="section-head">Plan Expenses</div>
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
        <div className="section-head" style={{ marginTop: 20 }}>Employer Payment Method</div>
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

      <FormErrorSummary errors={errors} />

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
