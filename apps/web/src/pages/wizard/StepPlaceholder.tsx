import { useNavigate, useParams } from "react-router-dom";
import { STEP_REGISTRY, type StepKey } from "@vestara/shared";

/**
 * Scaffold for the remaining wizard steps (eligibility, vesting,
 * administration, trustees_funds). Deliberately NOT a fake form — it's
 * honest about being unimplemented so nobody mistakes a stub for a
 * finished step. Follow the exact pattern in StepIdentity.tsx /
 * StepContributions.tsx to build these out:
 *   1. Pull the Zod schema for this step from @vestara/shared
 *   2. useForm + zodResolver against it
 *   3. useEffect: reset() from plan.stepData on load (resumability)
 *   4. useUpdateStep(planId, stepKey) on submit
 *   5. navigate to the next step key
 */
export function StepPlaceholder({ stepKey }: { stepKey: StepKey }) {
  const { planId } = useParams();
  const navigate = useNavigate();
  const step = STEP_REGISTRY.find((s) => s.key === stepKey)!;
  const nextStep = STEP_REGISTRY[step.index + 1];

  return (
    <div>
      <div className="panel-eyebrow">
        Step {step.index + 1} of {STEP_REGISTRY.length + 1}
      </div>
      <div className="panel-title">{step.label}</div>
      <div className="inline-alert warn" style={{ marginBottom: 24 }}>
        This step's form UI hasn't been built yet — the Zod schema, API route, and DB persistence for{" "}
        <code>{stepKey}</code> already work end-to-end (see <code>packages/shared/src/schemas/{stepKey === "trustees_funds" ? "trusteesFunds" : stepKey}.ts</code>).
        Build the form following the pattern in <code>StepIdentity.tsx</code>.
      </div>
      <div className="panel-actions">
        <button className="btn-back" onClick={() => navigate(-1)}>
          ← Back
        </button>
        {nextStep ? (
          <button className="btn-primary" onClick={() => navigate(`/onboarding/${planId}/step/${nextStep.key}`)}>
            Skip to {nextStep.label} (dev only) →
          </button>
        ) : (
          <button className="btn-primary" onClick={() => navigate(`/onboarding/${planId}/review`)}>
            Skip to Review (dev only) →
          </button>
        )}
      </div>
    </div>
  );
}
