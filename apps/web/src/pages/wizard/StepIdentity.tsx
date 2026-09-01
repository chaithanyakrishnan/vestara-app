import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { IdentityStepSchema, type IdentityStepInput } from "@vestara/shared";
import { usePlan } from "../../hooks/usePlan";
import { useUpdateStep, isApiValidationError } from "../../hooks/useUpdateStep";
import { FormField } from "../../components/FormField";
import { FormErrorSummary } from "../../components/FormErrorSummary";
import { PhoneInput } from "../../components/PhoneInput";
import { EinInput, formatEin } from "../../components/EinInput";
import { DateInput } from "../../components/DateInput";
import { AffixInput } from "../../components/AffixInput";
import { RevealSection } from "../../components/ToggleRow";
import { AiSectionBanner } from "../../components/AiSectionBanner";
import { AiProvenanceProvider } from "../../components/AiProvenance";
import { formatPhoneNumber } from "../../lib/phone";
import { formatDateInput } from "../../lib/date";
import { numericField } from "../../lib/forms";
import { formatCompanyAddress } from "../../data/companies";
import { PAYROLL_PROVIDERS, PRIOR_RECORDKEEPERS } from "../../data/datalists";

const defaults: IdentityStepInput = {
  planType: "401k",
  employerEin: "",
  employerName: "",
  employerAddress: "",
  planName: "",
  planNumber: "",
  planYearEnd: "Dec 31",
  trustName: "",
  planStatus: "new",
  originalEffectiveDate: "",
  transferEffectiveDate: "",
  previousRecordkeeper: "",
  previousRecordkeeperContact: "",
  previousRecordkeeperPhone: "",
  previousRecordkeeperEmail: "",
  payrollProvider: "",
};

export function StepIdentity() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan } = usePlan(planId);
  const updateStep = useUpdateStep(planId, "identity");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<IdentityStepInput>({ resolver: zodResolver(IdentityStepSchema), defaultValues: defaults });

  // Hydrate from the server draft once it loads — this is what makes the
  // step resumable after a refresh or a return visit.
  useEffect(() => {
    const existing = plan?.stepData?.find((s: any) => s.stepKey === "identity")?.data;
    // Normalize masked values on the way in: an AI extraction can hand back
    // "890.950.4950" or "3-1-2002", and the masked inputs only reformat on
    // interaction, so hydrated values would otherwise sit there unformatted.
    if (existing) {
      reset({
        ...defaults,
        ...existing,
        employerEin: formatEin(existing.employerEin ?? ""),
        employerPhone: formatPhoneNumber(existing.employerPhone ?? ""),
        previousRecordkeeperPhone: formatPhoneNumber(existing.previousRecordkeeperPhone ?? ""),
        originalEffectiveDate: formatDateInput(existing.originalEffectiveDate ?? ""),
        restatedEffectiveDate: formatDateInput(existing.restatedEffectiveDate ?? ""),
        transferEffectiveDate: formatDateInput(existing.transferEffectiveDate ?? ""),
      });
    }
  }, [plan, reset]);

  const planStatus = watch("planStatus");
  const originalEffectiveDate = watch("originalEffectiveDate");
  const restatedEffectiveDate = watch("restatedEffectiveDate");
  const transferEffectiveDate = watch("transferEffectiveDate");
  const isTransfer = planStatus === "transfer";

  async function onSubmit(data: IdentityStepInput) {
    try {
      await updateStep.mutateAsync(data);
      navigate(`/onboarding/${planId}/step/contributions`);
    } catch (err) {
      if (isApiValidationError(err)) {
        err.issues!.forEach((issue) => setError(issue.path as keyof IdentityStepInput, { message: issue.message }));
      }
    }
  }

  return (
    <AiProvenanceProvider plan={plan} stepKey="identity">
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="panel-eyebrow">Step 1 of 7</div>
      <div className="panel-title">Company & Plan Identity</div>
      <div className="panel-desc">
        These elections define your plan's legal identity and appear throughout all plan documents.
      </div>

      <AiSectionBanner plan={plan} stepKey="identity" />

      <div className="section-head">Plan Type</div>
      <div className="form-grid">
        <FormField name="planType" label="Plan Type" required colSpan2 error={errors.planType}>
          <select {...register("planType")}>
            <option value="401k">401(k) — Private / for-profit employer</option>
            <option value="403b">403(b) — Non-profit / public school / hospital</option>
            <option value="457b_gov">457(b) Governmental</option>
            <option value="457b_nongov">457(b) Non-governmental</option>
            <option value="401a">401(a) — Defined contribution / profit sharing</option>
          </select>
        </FormField>
      </div>

      <div className="section-head">Employer</div>
      <div className="form-grid">
        <FormField name="employerEin"
          label="Employer EIN"
          required
          colSpan2
          error={errors.employerEin}
          hint="Formats automatically as you type. Type digits or a company name to search."
        >
          <EinInput
            registration={register("employerEin")}
            placeholder="XX-XXXXXXX"
            onSelectCompany={(company) => {
              // Mirrors the prototype: picking a company fills the employer
              // fields and proposes plan/trust names if they're still blank.
              const opts = { shouldValidate: true, shouldDirty: true } as const;
              setValue("employerName", company.name, opts);
              setValue("employerAddress", formatCompanyAddress(company), opts);
              if (!watch("planName")) setValue("planName", `${company.name} 401(k) Plan`, opts);
              if (!watch("trustName")) setValue("trustName", `${company.name} 401(k) Plan Trust`, opts);
            }}
          />
        </FormField>
        <FormField name="employerName" label="Legal Employer Name" required colSpan2 error={errors.employerName}>
          <input {...register("employerName")} placeholder="e.g. 4 Bears Casino & Lodge" />
        </FormField>
        <FormField name="employerAddress" label="Employer Address" colSpan2 error={errors.employerAddress}>
          <input {...register("employerAddress")} placeholder="Street, City, State ZIP" />
        </FormField>
        <FormField name="employerPhone" label="Employer Phone" error={errors.employerPhone} hint="Formats automatically as you type.">
          <PhoneInput registration={register("employerPhone")} placeholder="(XXX) XXX-XXXX" />
        </FormField>
      </div>

      <div className="section-head">Plan Legal Identity</div>
      <div className="form-grid">
        <FormField name="planName" label="Plan Name" required colSpan2 error={errors.planName} hint="Must be legally distinct from the employer name.">
          <input {...register("planName")} placeholder="e.g. 4 Bears Casino & Lodge 401(k) Plan" />
        </FormField>
        <FormField name="planNumber" label="Plan Number" required error={errors.planNumber} hint="3-digit plan number. First plan = 001.">
          <input {...register("planNumber")} placeholder="001" maxLength={3} style={{ maxWidth: 120 }} />
        </FormField>
        <FormField name="planYearEnd" label="Plan Year End" required error={errors.planYearEnd}>
          <select {...register("planYearEnd")}>
            <option value="Dec 31">December 31</option>
            <option value="Jun 30">June 30</option>
            <option value="Sep 30">September 30</option>
            <option value="Mar 31">March 31</option>
          </select>
        </FormField>
        <FormField name="trustName" label="Trust Name" colSpan2 error={errors.trustName} hint="Leave blank to auto-populate from Plan Name.">
          <input {...register("trustName")} placeholder="e.g. 4 Bears Casino & Lodge 401(k) Plan Trust" />
        </FormField>
      </div>

      <div className="section-head">Effective Dates</div>
      <div className="form-grid">
        <FormField name="planStatus" label="Plan Status" error={errors.planStatus}>
          <select {...register("planStatus")}>
            <option value="new">New Plan</option>
            <option value="transfer">Transfer — from another recordkeeper</option>
          </select>
        </FormField>
        <FormField name="originalEffectiveDate" label="Original Effective Date" error={errors.originalEffectiveDate} hint="Formats as you type, or pick from the calendar.">
          <DateInput
            registration={register("originalEffectiveDate")}
            setValue={setValue}
            name="originalEffectiveDate"
            value={originalEffectiveDate}
          />
        </FormField>
        {/* An amendment and restatement carries two dates and the document
            treats the restatement date as "the Effective Date". Keeping only
            the original one discarded the operative date on every sample. */}
        <FormField name="restatedEffectiveDate" label="Restated Effective Date" error={errors.restatedEffectiveDate} hint="If this plan is an amendment and restatement.">
          <DateInput
            registration={register("restatedEffectiveDate")}
            setValue={setValue}
            name="restatedEffectiveDate"
            value={restatedEffectiveDate}
          />
        </FormField>
      </div>

      <RevealSection open={isTransfer}>
        <div className="form-grid">
          <FormField name="transferEffectiveDate" label="Transfer Effective Date" error={errors.transferEffectiveDate}>
            <DateInput
              registration={register("transferEffectiveDate")}
              setValue={setValue}
              name="transferEffectiveDate"
              value={transferEffectiveDate}
            />
          </FormField>
        </div>

        <div className="section-head">
          Previous Recordkeeper <span className="section-badge">Required for transfers</span>
        </div>
        <div className="form-grid">
          <FormField name="previousRecordkeeper" label="Previous Recordkeeper" required colSpan2 error={errors.previousRecordkeeper}>
            <input {...register("previousRecordkeeper")} list="prevRkList" placeholder="e.g. Fidelity, Empower, Voya…" />
            <datalist id="prevRkList">
              {PRIOR_RECORDKEEPERS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </FormField>
          <FormField name="previousRecordkeeperContact" label="Contact Name" error={errors.previousRecordkeeperContact}>
            <input {...register("previousRecordkeeperContact")} placeholder="Full name" />
          </FormField>
          <FormField name="previousRecordkeeperPhone" label="Contact Phone" error={errors.previousRecordkeeperPhone} hint="Format: (XXX) XXX-XXXX">
            <PhoneInput registration={register("previousRecordkeeperPhone")} placeholder="(XXX) XXX-XXXX" />
          </FormField>
          <FormField name="previousRecordkeeperEmail" label="Contact Email" error={errors.previousRecordkeeperEmail}>
            <input {...register("previousRecordkeeperEmail")} placeholder="name@domain.com" />
          </FormField>
          <FormField name="approxAssetsTransferring" label="Approx. Plan Assets Transferring" error={errors.approxAssetsTransferring}>
            <AffixInput
              registration={register("approxAssetsTransferring", numericField)}
              prefix="$"
              className="mono"
              type="number"
              min={0}
              step={1000}
              placeholder="0"
            />
          </FormField>
        </div>
      </RevealSection>

      <div className="section-head">Payroll Integration</div>
      <div className="form-grid">
        <FormField name="payrollProvider" label="Payroll Provider" colSpan2 error={errors.payrollProvider}>
          <input {...register("payrollProvider")} list="payrollList" placeholder="e.g. ADP, Paychex, Gusto…" />
          <datalist id="payrollList">
            {PAYROLL_PROVIDERS.map((p) => <option key={p} value={p} />)}
          </datalist>
        </FormField>
      </div>
      <div className="inline-alert info" style={{ marginTop: 12 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        Once connected, participant census and deferral data sync automatically from your payroll provider —
        no manual roster upload needed.
      </div>

      <FormErrorSummary errors={errors} />

      <div className="panel-actions">
        <button type="button" className="btn-back" onClick={() => navigate(`/onboarding/${planId}/intake`)}>
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
