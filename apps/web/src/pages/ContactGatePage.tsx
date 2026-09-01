import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { ContactGateSchema, type ContactGateInput } from "@vestara/shared";
import { useCreatePlan } from "../hooks/usePlans";
import { FormField } from "../components/FormField";
import { PhoneInput } from "../components/PhoneInput";
import { ToggleRow, RevealSection } from "../components/ToggleRow";

const defaultValues: ContactGateInput = {
  advisor: { name: "", email: "", phone: "", firm: "", title: "", fiduciary: "unsure" },
  sponsor: { name: "", email: "", phone: "", org: "", title: "" },
  tpa: { engaged: false, firm: "", name: "", email: "", phone: "" },
};

const AdvisorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const SponsorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
  </svg>
);

const TpaIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 21V8l8-5 8 5v13" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

export function ContactGatePage() {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactGateInput>({ resolver: zodResolver(ContactGateSchema), defaultValues });
  const tpaEngaged = watch("tpa.engaged");
  const createPlan = useCreatePlan();
  const navigate = useNavigate();

  async function onSubmit(data: ContactGateInput) {
    const plan = await createPlan.mutateAsync(data);
    navigate(`/onboarding/${plan.id}/plan-status`);
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 60px" }}>
      <button
        type="button"
        className="btn-back"
        style={{ border: "none", padding: "0 0 24px", fontSize: 12, color: "var(--muted)" }}
        onClick={() => navigate("/dashboard")}
      >
        ← Back to dashboard
      </button>

      <div className="flow-head">
        <span className="flow-step-num">1</span>
        <h1 className="flow-title">Advisor and Sponsor Information</h1>
      </div>
      <div className="panel-desc">
        Identify the Financial Advisor and Plan Sponsor contact. Both receive the plan document for
        signature. Optionally capture a Third Party Administrator (TPA) if one is engaged.
      </div>

      {/* Why a typed-and-clicked signature is sufficient here. Sponsors ask,
          and the answer is a legal one rather than a product one. */}
      <div className="compliance-note">
        <span className="compliance-note-icon" aria-hidden="true">i</span>
        <p>
          <strong>E-signature compliance:</strong> Electronic signatures are legally valid under the
          ESIGN Act (2000) and UETA. E-signature audit trails satisfy DOL and IRS documentation
          requirements under ERISA Section 107.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="gate-panels">
          {/* ── Financial Advisor ──────────────────────────── */}
          <div className="gate-panel">
            <div className="gate-panel-badge">
              <AdvisorIcon />
              Financial Advisor
            </div>
            <div className="form-grid">
              <FormField label="Full Name" required error={errors.advisor?.name}>
                <input {...register("advisor.name")} placeholder="Jane Advisor" />
              </FormField>
              <FormField
                label="Email Address"
                required
                error={errors.advisor?.email}
                hint="Format: name@domain.com"
              >
                <input {...register("advisor.email")} type="email" placeholder="name@domain.com" />
              </FormField>
              <FormField
                label="Phone Number"
                error={errors.advisor?.phone}
                hint="Formats automatically as you type"
              >
                <PhoneInput registration={register("advisor.phone")} placeholder="(XXX) XXX-XXXX" />
              </FormField>
              <FormField label="Firm / RIA Name" required error={errors.advisor?.firm}>
                <input {...register("advisor.firm")} placeholder="e.g. LPL Financial" />
              </FormField>
              <FormField label="Title" error={errors.advisor?.title}>
                <input {...register("advisor.title")} placeholder="e.g. SVP" />
              </FormField>
              <FormField label="Fiduciary Role" error={errors.advisor?.fiduciary}>
                <select {...register("advisor.fiduciary")}>
                  <option value="3_21">3(21) — Investment Advisor (non-discretionary)</option>
                  <option value="3_38">3(38) — Investment Manager (discretionary)</option>
                  <option value="non_fid">Non-fiduciary</option>
                  <option value="unsure">Not sure yet</option>
                </select>
              </FormField>
            </div>
          </div>

          {/* ── Plan Sponsor Contact ───────────────────────── */}
          <div className="gate-panel sponsor">
            <div className="gate-panel-badge">
              <SponsorIcon />
              Plan Sponsor Contact
            </div>
            <div className="form-grid">
              <FormField label="Contact Full Name" required error={errors.sponsor?.name}>
                <input {...register("sponsor.name")} placeholder="Full name" />
              </FormField>
              <FormField
                label="Email Address"
                required
                error={errors.sponsor?.email}
                hint="Format: name@domain.com"
              >
                <input {...register("sponsor.email")} type="email" placeholder="name@domain.com" />
              </FormField>
              <FormField
                label="Phone Number"
                error={errors.sponsor?.phone}
                hint="Formats automatically as you type"
              >
                <PhoneInput registration={register("sponsor.phone")} placeholder="(XXX) XXX-XXXX" />
              </FormField>
              <FormField label="Organization / Employer Name" required error={errors.sponsor?.org}>
                <input {...register("sponsor.org")} placeholder="e.g. Altimetrik One" />
              </FormField>
              <FormField label="Title" error={errors.sponsor?.title}>
                <input {...register("sponsor.title")} placeholder="e.g. VP of Benefits" />
              </FormField>
            </div>
          </div>
        </div>

        {/* ── Third Party Administrator ──────────────────────
            Elect-then-configure, matching the wizard's safe-harbour and loan
            blocks. Full width below the two party panels because it is a
            conditional third party, not a peer of advisor and sponsor. */}
        <div className="gate-panel tpa" style={{ marginTop: 24 }}>
          <div className="gate-panel-badge">
            <TpaIcon />
            Third Party Administrator (TPA)
          </div>
          <ToggleRow
            label="A TPA is engaged for this plan"
            sub="TPAs handle plan document drafting, Form 5500 preparation, discrimination testing and compliance consulting. Required if the plan uses a non-prototype plan document."
            checked={!!tpaEngaged}
            onChange={(next) => {
              setValue("tpa.engaged", next, { shouldValidate: true, shouldDirty: true });
              // Toggling off must strip the dependents, or a firm typed and
              // then un-elected would still be written as a TPA row.
              if (!next) {
                setValue("tpa.firm", "");
                setValue("tpa.name", "");
                setValue("tpa.email", "");
                setValue("tpa.phone", "");
              }
            }}
          />
          <RevealSection open={!!tpaEngaged}>
            <div className="form-grid tpa-grid">
              <FormField label="TPA Firm Name" required error={errors.tpa?.firm}>
                <input {...register("tpa.firm")} placeholder="TPA company name" />
              </FormField>
              <FormField label="TPA Contact Name" error={errors.tpa?.name}>
                <input {...register("tpa.name")} placeholder="Primary contact at the TPA" />
              </FormField>
              <FormField label="TPA Email" error={errors.tpa?.email} hint="Format: name@domain.com">
                <input {...register("tpa.email")} type="email" placeholder="contact@tpa.com" />
              </FormField>
              <FormField
                label="TPA Phone"
                error={errors.tpa?.phone}
                hint="Formats automatically as you type"
              >
                <PhoneInput registration={register("tpa.phone")} placeholder="(XXX) XXX-XXXX" />
              </FormField>
            </div>
          </RevealSection>
        </div>

        {createPlan.isError && (
          <div className="inline-alert error" style={{ marginTop: 20 }}>
            {(createPlan.error as Error).message}
          </div>
        )}

        <div className="panel-actions">
          <button type="button" className="btn-back" onClick={() => navigate("/dashboard")}>
            ← Cancel
          </button>
          <button className="btn-primary" type="submit" disabled={createPlan.isPending}>
            {createPlan.isPending ? "Starting…" : "Start Onboarding"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
