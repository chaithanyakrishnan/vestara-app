import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "../lib/apiClient";
import { usePlan } from "../hooks/usePlan";
import { PartiesBanner } from "../components/PartiesBanner";
import { OptionCard, OptionGrid } from "../components/OptionCard";

/**
 * New plan or transfer, asked before the intake method.
 *
 * It comes first because it changes what the rest of onboarding needs: a
 * transfer has to name the prior recordkeeper, carry a conversion date and
 * account for existing balances and participant history, none of which a
 * brand-new plan has. Asking it up front also means the upload path knows what
 * kind of document to expect.
 *
 * The election is written to `identity.planStatus` — the same field the
 * Identity step edits — so there is one source of truth and returning here
 * shows what was chosen.
 */
export function PlanStatusPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plan } = usePlan(planId);

  const [choice, setChoice] = useState<"new" | "transfer" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reflect an election already on the draft, so coming back here (or a
  // refresh) shows the current answer rather than an empty pair of cards.
  useEffect(() => {
    const saved = plan?.stepData?.find((s: any) => s.stepKey === "identity")?.data?.planStatus;
    if (saved === "new" || saved === "transfer") setChoice(saved);
  }, [plan]);

  async function cont() {
    if (!planId || !choice) return;
    setBusy(true);
    setError(null);
    try {
      await api.put(`/plans/${planId}/plan-status`, { planStatus: choice });
      await queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      navigate(`/onboarding/${planId}/intake`);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Could not save your choice. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 60px" }}>
      <button
        type="button"
        className="btn-back"
        style={{ border: "none", padding: "0 0 24px", fontSize: 12, color: "var(--muted)" }}
        onClick={() => navigate("/dashboard")}
      >
        ← Back to dashboard
      </button>

      <div className="flow-head">
        <span className="flow-step-num">2</span>
        <h1 className="flow-title">New plan or transfer?</h1>
      </div>
      <div className="panel-desc">
        Select whether this is a new retirement plan or an existing plan transferring from another
        recordkeeper. Transfer plans trigger additional required disclosures.
      </div>

      <PartiesBanner plan={plan} />

      {error && <div className="inline-alert error" style={{ marginBottom: 16 }}>{error}</div>}

      <OptionGrid cols={2}>
        <OptionCard
          selected={choice === "new"}
          onSelect={() => setChoice("new")}
          title={
            <>
              New plan <span className="req-badge">New</span>
            </>
          }
          desc="Setting up a brand-new retirement plan for the first time with this recordkeeper."
        />
        <OptionCard
          selected={choice === "transfer"}
          onSelect={() => setChoice("transfer")}
          title={
            <>
              Transfer / conversion <span className="req-badge amber">Transfer</span>
            </>
          }
          desc="Moving an existing plan from another recordkeeper. History, balances, and participant data will be migrated."
        />
      </OptionGrid>

      <div className="panel-actions">
        <button type="button" className="btn-back" onClick={() => navigate("/onboarding/new")}>
          ← Back
        </button>
        <button type="button" className="btn-primary" disabled={!choice || busy} onClick={cont}>
          {busy ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
