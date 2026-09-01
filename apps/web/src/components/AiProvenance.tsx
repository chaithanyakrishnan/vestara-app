import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { StepKey } from "@vestara/shared";
import { confidencePct, confidenceLabel, confidenceTier, LOW_CONFIDENCE } from "../lib/confidence";

/**
 * Carries a step's AI-extraction provenance down to individual `FormField`s.
 *
 * Context rather than prop-drilling because a step form has 15+ fields and every
 * one would otherwise need the same two props threaded through. `FormField`
 * looks itself up by `name`, so marking a form as AI-aware is one wrapper plus
 * a `name` on each field.
 */

interface AiProvenanceValue {
  /** True when this section was written by an extraction rather than by hand. */
  isAi: boolean;
  /** Per-field confidence 0..1, keyed by schema field name. */
  confidences: Record<string, number>;
}

const AiProvenanceContext = createContext<AiProvenanceValue>({ isAi: false, confidences: {} });

export function AiProvenanceProvider({
  plan,
  stepKey,
  children,
}: {
  plan: any;
  stepKey: StepKey;
  children: ReactNode;
}) {
  const value = useMemo<AiProvenanceValue>(() => {
    const row = plan?.provenance?.find((p: any) => p.fieldPath === stepKey);
    if (!row || row.source !== "ai") return { isAi: false, confidences: {} };
    return {
      isAi: true,
      confidences: (row.fieldConfidences as Record<string, number>) ?? {},
    };
  }, [plan, stepKey]);

  return <AiProvenanceContext.Provider value={value}>{children}</AiProvenanceContext.Provider>;
}

export function useFieldProvenance(name?: string) {
  const { isAi, confidences } = useContext(AiProvenanceContext);
  if (!isAi || !name) return null;
  // A field the extraction never reported is a manual field even inside an
  // AI-filled section — don't badge it.
  const confidence = confidences[name];
  if (typeof confidence !== "number") return null;
  return { confidence, isLow: confidence < LOW_CONFIDENCE };
}

/**
 * The two chips that sit beside a field's label when an extraction filled it:
 * a flat "AI" marker and a HIGH/MEDIUM/LOW confidence pill.
 *
 * Rendered only for fields the extraction actually reported — a field it left
 * alone carries no chips at all, so the badges mean "this came from your
 * document" rather than "this form is AI-aware".
 */
export function AiFieldBadge({ confidence }: { confidence: number }) {
  const tier = confidenceTier(confidence);
  return (
    <>
      <span className="ai-chip" title="Pre-filled from your uploaded document">
        AI
      </span>
      <span
        className={`conf-chip conf-${tier}`}
        title={`${confidenceLabel(confidence)} (${confidencePct(confidence)})`}
      >
        <span className="conf-dot" aria-hidden="true" />
        {tier}
      </span>
    </>
  );
}
