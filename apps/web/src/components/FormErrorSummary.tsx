import type { FieldErrors } from "react-hook-form";
import { fieldLabel } from "../lib/reviewFormat";

/**
 * Lists every validation error on a step form, right above its actions.
 *
 * Each field already renders its own error through `FormField`, but several of
 * these forms hide fields inside a collapsed `RevealSection` (loan terms, the
 * employer payment block, auto-enrolment). An error on a hidden field has
 * nowhere to render, so pressing "Save & Continue" did nothing at all with no
 * explanation — the failure mode reported on the Administration step. This
 * summary makes any such error visible wherever it came from.
 */
export function FormErrorSummary({
  errors,
  submitError,
}: {
  errors: FieldErrors;
  /**
   * A server rejection that is NOT a field-level ZodError — the 422s thrown by
   * the cross-step business rules in irsVestingFloor.ts, for instance. These
   * carry a message but no `issues`, so the step forms' `setError` branch
   * ignored them entirely: the request failed, nothing rendered, and Continue
   * looked broken. That was the reported "Vesting continue button does nothing".
   */
  submitError?: string | null;
}) {
  const rows = Object.entries(errors)
    .map(([field, error]) => [field, (error as { message?: string })?.message] as const)
    .filter((row): row is readonly [string, string] => !!row[1]);

  if (rows.length === 0 && !submitError) return null;

  if (rows.length === 0 && submitError) {
    return (
      <div className="inline-alert error" style={{ marginTop: 20 }}>
        <span>{submitError}</span>
      </div>
    );
  }

  return (
    <div className="inline-alert error" style={{ marginTop: 20 }}>
      <span>
        {rows.length === 1 ? "One field needs" : `${rows.length} fields need`} attention before you can
        continue:
        <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
          {rows.map(([field, message]) => (
            <li key={field}>
              <strong>{fieldLabel(field)}</strong> — {message}
            </li>
          ))}
        </ul>
        {submitError && <div style={{ marginTop: 8 }}>{submitError}</div>}
      </span>
    </div>
  );
}
