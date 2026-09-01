import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "../lib/apiClient";
import { usePlan } from "../hooks/usePlan";
import { PartiesBanner } from "../components/PartiesBanner";

/**
 * Intake method chooser, matching the prototype's card layout.
 *
 * "Enter Manually" resets the draft server-side before entering the wizard.
 * Without that, a plan that already had a document extracted would drop the
 * user into pre-filled fields immediately after they chose to start fresh —
 * the forms hydrate from whatever is saved against the plan.
 */
export function IntakeMethodPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plan } = usePlan(planId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startManually() {
    if (!planId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/plans/${planId}/reset-draft`, {});
      // Drop the cached plan so the wizard can't hydrate from the pre-reset copy.
      await queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      navigate(`/onboarding/${planId}/step/identity`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not start a blank plan");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 60px" }}>
      <button
        type="button"
        className="btn-back"
        style={{ border: "none", padding: "0 0 24px", fontSize: 12, color: "var(--muted)" }}
        onClick={() => navigate(`/onboarding/${planId}/plan-status`)}
      >
        ← Back
      </button>

      <div className="flow-head">
        <span className="flow-step-num">3</span>
        <h1 className="flow-title">Choose your onboarding method</h1>
      </div>
      <div className="panel-desc">
        If you have an existing adoption agreement, upload it and our AI will read every election and
        pre-fill the wizard. Or start fresh and answer each question step by step.
      </div>

      <PartiesBanner plan={plan} />

      {error && <div className="inline-alert error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="intake-cards">
        <button
          type="button"
          className="intake-card primary"
          disabled={busy}
          onClick={() => navigate(`/onboarding/${planId}/upload`)}
        >
          <span className="intake-card-badge">Recommended</span>
          <span className="intake-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--green-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </span>
          <span className="intake-card-title">Upload Adoption Agreement</span>
          <span className="intake-card-desc">
            Upload your existing adoption agreement and our AI will read every election — EIN, plan name,
            safe harbor type, vesting schedule, loans, trustees — and pre-fill the entire wizard for you.
            You review and confirm.
          </span>
          <span className="intake-card-pills">
            <span className="intake-pill">PDF</span>
            <span className="intake-pill">Saves 20-30 min</span>
            <span className="intake-pill">50+ fields auto-filled</span>
          </span>
          <span className="intake-card-cta">
            Upload document
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>

        <button type="button" className="intake-card" disabled={busy} onClick={startManually}>
          <span className="intake-icon teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--cream)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </span>
          <span className="intake-card-title">Enter Manually</span>
          <span className="intake-card-desc">
            Answer each plan design question step by step. Best for new plans with no existing document, or
            when you want full control over every election from the start.
          </span>
          <span className="intake-card-pills">
            <span className="intake-pill">7 guided steps</span>
            <span className="intake-pill">Plain-language</span>
            <span className="intake-pill">Contextual help</span>
          </span>
          <span className="intake-card-cta">
            {busy ? "Clearing…" : "Start from scratch"}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
}
