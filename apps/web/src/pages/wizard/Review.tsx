import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlan } from "../../hooks/usePlan";
import { usePlanType } from "../../hooks/usePlanTypeForm";
import { api, ApiClientError } from "../../lib/apiClient";
import { STEP_REGISTRY } from "@vestara/shared";
import { buildReviewSection, contactRows, missingFieldLabels } from "../../lib/reviewFormat";

export function Review() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan, refetch } = usePlan(planId);
  const planType = usePlanType(plan);
  const alreadySubmitted = plan?.status && plan.status !== "draft";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!planId) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/plans/${planId}/submit`);
      await refetch();
      navigate(`/onboarding/${planId}/success`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!plan) return <div>Loading…</div>;

  // Presence is NOT completeness. AI extraction writes a section as soon as any
  // field in it validates, so a step can hold data and still be missing
  // required fields — and the server's submit check re-validates every stored
  // section. Checking only for existence here meant the screen said "ready",
  // the user signed, and the API answered with a raw 422. Run the same
  // per-field validation the server runs, and name what's outstanding.
  const sections = STEP_REGISTRY.map((step) => {
    const section = plan.stepData?.find((s: any) => s.stepKey === step.key);
    // Trustees live in the normalized table as well; prefer it so both the
    // review rows and this check reflect what validateReadyToSubmit sees.
    const data =
      step.key === "trustees_funds" && section
        ? { ...(section.data as object), trustees: plan.trustees ?? (section.data as any)?.trustees }
        : section?.data;
    return {
      step,
      section,
      data,
      missing: section ? missingFieldLabels(step.key, data, planType) : [],
    };
  });

  const incomplete = sections.filter((s) => !s.section || s.missing.length > 0);
  const ready = incomplete.length === 0;

  // Mirrors SIGNER_ROLES in the API's esign.service — the roster the server
  // will actually build at submit time.
  const roster = [
    { role: "sponsor", label: "Plan Sponsor" },
    { role: "advisor", label: "Financial Advisor" },
    { role: "tpa", label: "Third Party Administrator" },
  ]
    .map((r) => ({ ...r, contact: plan.contacts?.find((c: any) => c.type === r.role) }))
    .filter((r) => r.contact);
  const signers = roster
    .filter((r) => r.contact.email)
    .map((r) => ({
      role: r.role,
      label: r.label,
      name: r.contact.name || r.contact.org || r.label,
      email: r.contact.email as string,
    }));
  const missingEmail = roster.filter((r) => !r.contact.email).map((r) => r.label);

  return (
    <div>
      <div className="panel-eyebrow">Step {STEP_REGISTRY.length + 1} of {STEP_REGISTRY.length + 1}</div>
      <div className="panel-title">Review &amp; Submit</div>
      <div className="panel-desc">
        Check every election below. Submitting locks the plan and sends an e-signature request to each party
        — the elections are executed in those envelopes, not on this page.
      </div>

      {incomplete.length > 0 && (
        <div className="inline-alert warn" style={{ marginBottom: 20 }}>
          <span>
            {incomplete.length} step{incomplete.length > 1 ? "s are" : " is"} still incomplete. Submission
            is blocked until each one has valid data:
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              {incomplete.map((s) => (
                <li key={s.step.key}>
                  <button
                    type="button"
                    onClick={() => navigate(`/onboarding/${planId}/step/${s.step.key}`)}
                    className="link-button"
                  >
                    {s.step.label}
                  </button>
                  {s.missing.length > 0 ? ` — needs ${s.missing.join(", ")}` : " — not started"}
                </li>
              ))}
            </ul>
          </span>
        </div>
      )}

      <div className="review-section">
        <h4>Contacts</h4>
        {contactRows(plan.contacts).map(([key, value]) => (
          <div className="review-row" key={key}>
            <div className="review-key">{key}</div>
            <div className="review-val">{value}</div>
          </div>
        ))}
      </div>

      {sections.map(({ step, section, data, missing }) => {
        return (
          <div className="review-section" key={step.key}>
            <h4>{step.label}</h4>
            {section ? (
              <>
                {missing.length > 0 && (
                  <div className="inline-alert warn" style={{ marginBottom: 10 }}>
                    <span>
                      Still needed: {missing.join(", ")}.{" "}
                      <button
                        type="button"
                        onClick={() => navigate(`/onboarding/${planId}/step/${step.key}`)}
                        className="link-button"
                      >
                        Finish {step.label}
                      </button>
                    </span>
                  </div>
                )}
                {buildReviewSection(step.key, data).map(([key, value]) => (
                  <div className="review-row" key={key}>
                    <div className="review-key">{key}</div>
                    <div className="review-val">{value}</div>
                  </div>
                ))}
              </>
            ) : (
              <div className="inline-alert warn">
                <span>
                  Not completed yet.{" "}
                  <button
                    type="button"
                    onClick={() => navigate(`/onboarding/${planId}/step/${step.key}`)}
                    className="link-button"
                  >
                    Complete {step.label}
                  </button>
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Execution moved into the e-sign envelopes, so this panel states WHO
          will be asked rather than collecting a typed name. A contact with no
          email cannot receive an envelope, which is worth saying here — before
          submit — rather than leaving a party silently off the roster. */}
      <div className="esign-panel">
        <h4>Electronic signature</h4>
        <p className="esign-panel-desc">
          On submit, each party below receives an e-signature request for the Adoption Agreement. The plan is
          executed under ERISA Section 402 when every party has signed.
        </p>
        {signers.length > 0 ? (
          <ul className="signer-list">
            {signers.map((sg) => (
              <li className="signer-row" key={sg.role}>
                <span className={`signer-avatar ${sg.role}`}>{(sg.name || "?").charAt(0).toUpperCase()}</span>
                <span className="signer-id">
                  <span className="signer-name">{sg.name}</span>
                  <span className="signer-email">{sg.email}</span>
                </span>
                <span className="signer-role">{sg.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="inline-alert warn">
            <span>No contact on this plan has an email address, so no envelope can be sent.</span>
          </div>
        )}
        {missingEmail.length > 0 && (
          <div className="inline-alert warn" style={{ marginTop: 12 }}>
            <span>
              No email on file for the {missingEmail.join(" and ")}, so {missingEmail.length > 1 ? "they" : "it"}{" "}
              will not receive an envelope.
            </span>
          </div>
        )}
      </div>

      {alreadySubmitted && (
        <div className="inline-alert" style={{ marginTop: 16 }}>
          These elections were submitted on{" "}
          {plan.submittedAt ? new Date(plan.submittedAt).toLocaleDateString() : "an earlier date"} and are
          now final. Signature progress is shown above and on the dashboard.
        </div>
      )}

      {error && <div className="inline-alert error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="panel-actions">
        <button className="btn-back" onClick={() => navigate(alreadySubmitted ? "/dashboard" : `/onboarding/${planId}/step/trustees_funds`)}>
          ← {alreadySubmitted ? "Back to dashboard" : "Back"}
        </button>
        {alreadySubmitted ? (
          <button className="btn-primary" onClick={() => navigate(`/onboarding/${planId}/success`)}>
            View signature status
          </button>
        ) : (
          <button
            className="btn-primary"
            disabled={!ready || submitting}
            onClick={handleSubmit}
            title={ready ? undefined : "Every step must have valid data before you can submit"}
          >
            {submitting ? "Submitting…" : "Submit & request e-signatures"}
          </button>
        )}
      </div>
    </div>
  );
}
