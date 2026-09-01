import type { StepKey } from "@vestara/shared";

/**
 * "Pre-filled from your document" notice for a wizard section.
 *
 * FieldProvenance is recorded per STEP (fieldPath === the step key), not per
 * input, so this is deliberately one banner per section rather than a badge on
 * each field. A field-level diff view would need per-field provenance rows
 * first.
 */
export function AiSectionBanner({ plan, stepKey }: { plan: any; stepKey: StepKey }) {
  const fromAi = plan?.provenance?.some(
    (p: any) => p.fieldPath === stepKey && p.source === "ai",
  );
  if (!fromAi) return null;

  return (
    <div className="inline-alert info" style={{ marginBottom: 16 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      These elections were pre-filled from your uploaded adoption agreement. Review each field before
      continuing.
    </div>
  );
}
