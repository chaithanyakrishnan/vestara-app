import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { usePlan } from "../hooks/usePlan";
import { api, ApiClientError } from "../lib/apiClient";

/**
 * Post-submission screen: what was locked in, who still has to sign, and what
 * happens next.
 *
 * Everything on it is read from the plan — the signer list is the
 * PlanSignature rows the API created at submit, and "What happens next" quotes
 * the plan's own elections (its TPA, payroll provider, fund count, effective
 * date) rather than generic filler.
 */

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  signed: "Signed",
  declined: "Declined",
};

const ROLE_LABEL: Record<string, string> = {
  sponsor: "Plan Sponsor",
  advisor: "Financial Advisor",
  tpa: "Third Party Administrator",
};

function stepValue(plan: any, stepKey: string) {
  return (plan?.stepData?.find((s: any) => s.stepKey === stepKey)?.data ?? {}) as any;
}

export function SuccessPage() {
  const { planId } = useParams();
  const { data: plan, refetch } = usePlan(planId);
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ simulated: boolean; sent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!planId) return;
    setSending(true);
    setError(null);
    try {
      const result = await api.post<{ simulated: boolean; sent: number }>(`/plans/${planId}/esign/send`);
      setSendResult(result);
      await refetch();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not send the envelopes");
    } finally {
      setSending(false);
    }
  }

  if (!plan) return <div className="dash-empty">Loading…</div>;

  const identity = stepValue(plan, "identity");
  const funds = stepValue(plan, "trustees_funds");
  const tpa = plan.contacts?.find((c: any) => c.type === "tpa");
  const signatures: any[] = plan.signatures ?? [];
  const outstanding = signatures.filter((s) => s.status !== "signed");
  const planName = identity.planName || "This plan";
  const effectiveDate = identity.restatedEffectiveDate || identity.originalEffectiveDate;

  const nextSteps = [
    tpa?.org
      ? `Plan document drafted by ${tpa.org} and sent for signature`
      : "Plan document drafted by your recordkeeper and sent for signature",
    "ERISA §412 fidelity bond confirmed — must be obtained before plan launch",
    identity.payrollProvider
      ? `Payroll integration configured with ${identity.payrollProvider}`
      : "Payroll integration configured once a provider is nominated",
    `Investment lineup loaded — ${funds.selectedFundTickers?.length ?? 0} funds, ${
      plan.trustees?.length ?? 0
    } trustee${(plan.trustees?.length ?? 0) === 1 ? "" : "s"} on the trust`,
    "SPD distributed to participants within 120 days of plan establishment",
    effectiveDate ? `Plan effective date: ${effectiveDate}` : "Plan effective date confirmed with the sponsor",
  ];

  return (
    <div className="success-page">
      <div className="success-check" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12.5l5.5 5.5L20 7" />
        </svg>
      </div>
      <h1 className="success-title">Plan submitted successfully</h1>
      <p className="success-sub">
        <strong>{planName}</strong> has been saved and locked.{" "}
        {outstanding.length > 0
          ? "Signature requests are being prepared."
          : "Every party has signed."}
      </p>
      {plan.refNumber && <div className="success-ref">Reference {plan.refNumber}</div>}

      {signatures.length > 0 && (
        <div className="success-card">
          <h4>{outstanding.length > 0 ? "Signatures pending" : "Signatures complete"}</h4>
          <ul className="signer-list">
            {signatures.map((sg) => (
              <li className="signer-row" key={sg.id}>
                <span className={`signer-avatar ${sg.role}`}>{(sg.name || "?").charAt(0).toUpperCase()}</span>
                <span className="signer-id">
                  <span className="signer-name">{sg.name}</span>
                  <span className="signer-email">{sg.email}</span>
                </span>
                <span className="signer-role">{ROLE_LABEL[sg.role] ?? sg.role}</span>
                <span className={`pill sig-${sg.status}`}>{STATUS_LABEL[sg.status] ?? sg.status}</span>
              </li>
            ))}
          </ul>

          {signatures.some((s) => s.status === "pending") && (
            <button className="btn-esign" onClick={handleSend} disabled={sending}>
              {sending ? "Sending…" : "Send e-signature envelopes now"}
            </button>
          )}

          {/* Say plainly when nothing actually left the building. Showing
              "Sent" for a simulated send would tell someone their sponsor had
              been emailed when nobody had. */}
          {sendResult && (
            <div className={`inline-alert ${sendResult.simulated ? "warn" : "info"}`} style={{ marginTop: 12 }}>
              <span>
                {sendResult.simulated
                  ? `${sendResult.sent} envelope${sendResult.sent === 1 ? "" : "s"} recorded in demo mode — DocuSign is not configured, so no email was actually sent.`
                  : `${sendResult.sent} envelope${sendResult.sent === 1 ? "" : "s"} sent for signature.`}
              </span>
            </div>
          )}
          {error && (
            <div className="inline-alert error" style={{ marginTop: 12 }}>
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      <div className="success-card">
        <h4>What happens next</h4>
        <ol className="next-steps">
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
        <button className="btn-primary" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
