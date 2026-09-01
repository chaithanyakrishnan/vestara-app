import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { STEP_REGISTRY } from "@vestara/shared";
import { usePlan } from "../hooks/usePlan";
import { usePlanType } from "../hooks/usePlanTypeForm";
import { api, ApiClientError } from "../lib/apiClient";
import { fieldEntries, missingFieldLabels } from "../lib/reviewFormat";
import { confidenceRgb, confidencePct, confidenceLabel, LOW_CONFIDENCE } from "../lib/confidence";

/**
 * Shows exactly what the AI read out of the uploaded document, per field, with
 * a confidence score — then lets the user accept it or discard it and start
 * from scratch.
 *
 * This sits BETWEEN the upload and step 1 on purpose. Extraction writes
 * straight into the draft, so without this screen the only way to find out what
 * was actually read is to walk all six wizard steps looking for surprises.
 *
 * It reads from the plan itself (stepData + provenance) rather than the extract
 * response, so a refresh or a later revisit shows the same thing.
 */
export function ExtractionReviewPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plan } = usePlan(planId);
  const planType = usePlanType(plan);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plan) return <div style={{ padding: 48 }}>Loading…</div>;

  const sections = STEP_REGISTRY.map((step) => {
    const stepData = plan.stepData?.find((s: any) => s.stepKey === step.key);
    const provenance = plan.provenance?.find((p: any) => p.fieldPath === step.key);
    const confidences: Record<string, number> =
      (provenance?.fieldConfidences as Record<string, number>) ?? {};
    const entries = stepData ? fieldEntries(stepData.data) : [];
    const scores = entries
      .map((e) => confidences[e.field])
      .filter((c): c is number => typeof c === "number");

    return {
      step,
      read: !!stepData,
      fromAi: provenance?.source === "ai",
      entries,
      confidences,
      // A section can be read only partly: the API keeps every field that
      // validated rather than discarding the section over one unreadable field.
      // Name what's still outstanding instead of letting the user discover it
      // when the wizard refuses to advance.
      missing: stepData ? missingFieldLabels(step.key, stepData.data, planType) : [],
      lowCount: scores.filter((c) => c < LOW_CONFIDENCE).length,
      mean: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    };
  });

  const readSections = sections.filter((s) => s.read);
  const partialSections = readSections.filter((s) => s.missing.length > 0);
  const fieldsRead = readSections.reduce((n, s) => n + s.entries.length, 0);
  const lowTotal = readSections.reduce((n, s) => n + s.lowCount, 0);
  const overall = (() => {
    const all = readSections.flatMap((s) =>
      s.entries.map((e) => s.confidences[e.field]).filter((c): c is number => typeof c === "number"),
    );
    return all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
  })();

  async function startOver() {
    if (!planId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/plans/${planId}/reset-draft`, {});
      await queryClient.invalidateQueries({ queryKey: ["plan", planId] });
      navigate(`/onboarding/${planId}/step/identity`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not clear the draft");
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px 60px" }}>
      <div className="panel-eyebrow">DOCUMENT READ</div>
      <div className="panel-title">Here's what we read from your document</div>
      <div className="panel-desc">
        Review the extracted elections below before they're used. Each value carries a confidence score —
        anything below {Math.round(LOW_CONFIDENCE * 100)}% is worth checking against your document. Nothing
        is final; every field stays editable in the wizard.
      </div>

      <div className="extract-summary">
        <div className="extract-stat">
          <div className="stat-value">
            {readSections.length}<span style={{ fontSize: 16, color: "var(--muted)" }}> / {STEP_REGISTRY.length}</span>
          </div>
          <div className="stat-label">sections read from the document</div>
        </div>
        <div className="extract-stat">
          <div className="stat-value">{fieldsRead}</div>
          <div className="stat-label">individual fields pre-filled</div>
        </div>
        <div className="extract-stat">
          <div
            className="stat-value"
            style={{ color: overall !== null ? confidenceRgb(overall) : undefined }}
          >
            {overall !== null ? confidencePct(overall) : "—"}
          </div>
          <div className="stat-label">
            average confidence
            {lowTotal > 0 && ` · ${lowTotal} field${lowTotal > 1 ? "s" : ""} to verify`}
          </div>
        </div>
      </div>

      {readSections.length === 0 && (
        <div className="inline-alert warn" style={{ marginBottom: 20 }}>
          <span>
            Nothing could be read from this document. That usually means it's a scanned image rather than a
            text PDF, or it isn't an adoption agreement. Start from scratch below, or go back and try a
            different file.
          </span>
        </div>
      )}

      {partialSections.length > 0 && (
        <div className="inline-alert warn" style={{ marginBottom: 20 }}>
          <span>
            {partialSections.length} section{partialSections.length > 1 ? "s were" : " was"} only partly
            readable. Everything we could read is kept below; the fields listed as still needed are waiting
            for you in the wizard.
          </span>
        </div>
      )}

      {lowTotal > 0 && (
        <div className="inline-alert warn" style={{ marginBottom: 20 }}>
          <span>
            {lowTotal} field{lowTotal > 1 ? "s were" : " was"} read with low confidence. They're highlighted
            in red in the wizard and carry their score next to each input.
          </span>
        </div>
      )}

      {sections.map((s) => {
        const isOpen = open[s.step.key] ?? (s.lowCount > 0 || s.missing.length > 0); // auto-expand anything worth checking
        return (
          <div className="extract-section" key={s.step.key}>
            <button
              type="button"
              className="extract-section-head"
              aria-expanded={isOpen}
              onClick={() => setOpen((o) => ({ ...o, [s.step.key]: !isOpen }))}
            >
              <svg className="es-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
              <span className="es-title">{s.step.label}</span>
              {s.read ? (
                <>
                  <span className="es-count">
                    {s.entries.length} fields{s.missing.length > 0 ? " · partial" : ""}
                  </span>
                  {s.mean !== null && (
                    <span
                      className="er-conf"
                      style={{ ["--conf-color" as string]: confidenceRgb(s.mean) }}
                      title={confidenceLabel(s.mean)}
                    >
                      {confidencePct(s.mean)}
                    </span>
                  )}
                </>
              ) : (
                <span className="es-count extract-not-read">not read</span>
              )}
            </button>

            {isOpen && (
              <div className="extract-rows">
                {!s.read && (
                  <div className="extract-row">
                    <span className="er-key extract-not-read">
                      This section wasn't found in the document — you'll fill it in yourself.
                    </span>
                  </div>
                )}
                {s.missing.length > 0 && (
                  <div className="extract-row">
                    <span className="er-key extract-not-read">
                      Still needed: {s.missing.join(", ")}
                    </span>
                  </div>
                )}
                {s.entries.map((e) => {
                  const c = s.confidences[e.field];
                  const hasScore = typeof c === "number";
                  return (
                    <div className="extract-row" key={e.field}>
                      <span className="er-key">{e.label}</span>
                      <span className="er-right">
                        <span className="er-val">{e.value}</span>
                        {hasScore && (
                          <>
                            <span
                              className="conf-bar"
                              style={{ ["--conf-color" as string]: confidenceRgb(c) }}
                              title={confidenceLabel(c)}
                            >
                              <span style={{ width: `${Math.round(c * 100)}%` }} />
                            </span>
                            <span
                              className="er-conf"
                              style={{ ["--conf-color" as string]: confidenceRgb(c) }}
                            >
                              {confidencePct(c)}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {error && <div className="inline-alert error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="panel-actions">
        <button type="button" className="btn-back" disabled={busy} onClick={startOver}>
          {busy ? "Clearing…" : "Discard and enter manually"}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => navigate(`/onboarding/${planId}/step/identity`)}
        >
          Use this data
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
