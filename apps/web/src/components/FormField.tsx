import { Children, cloneElement, isValidElement } from "react";
import type { ReactNode, ReactElement } from "react";
import type { FieldError } from "react-hook-form";
import { AiFieldBadge, useFieldProvenance } from "./AiProvenance";

interface FormFieldProps {
  label: ReactNode;
  /** Schema field name. Supplying it opts the field into the AI-provenance
   * badge when the surrounding step was pre-filled by an extraction. */
  name?: string;
  required?: boolean;
  /** Accepts any RHF error node — array-level errors carry a message too. */
  error?: FieldError | { message?: string };
  hint?: ReactNode;
  colSpan2?: boolean;
  colSpan3?: boolean;
  children: ReactNode;
}

/** Thin wrapper so every field gets consistent label/error/hint markup
 * without repeating it — matches the .field / .field-hint / .field-error
 * classes ported from the original prototype's CSS. */
export function FormField({
  label,
  name,
  required,
  error,
  hint,
  colSpan2,
  colSpan3,
  children,
}: FormFieldProps) {
  const provenance = useFieldProvenance(name);

  const classes = ["field"];
  if (colSpan2) classes.push("col-span-2");
  if (colSpan3) classes.push("col-span-3");

  // Tint the control itself when the extraction wasn't sure about it, so a
  // shaky value is visible without reading every badge.
  const control =
    provenance?.isLow && Children.count(children) === 1 && isValidElement(children)
      ? cloneElement(children as ReactElement<{ className?: string }>, {
          className: [(children as ReactElement<{ className?: string }>).props.className, "ai-low"]
            .filter(Boolean)
            .join(" "),
        })
      : children;

  return (
    <div className={classes.join(" ")}>
      {/* Chips sit on the label row, not under the control: the point is to
          say "this value came from your document, and here's how sure we are"
          BEFORE the reader takes the value at face value. A field the
          extraction didn't fill carries no chips at all. */}
      <label>
        {label} {required && <span className="req">*</span>}
        {provenance && <AiFieldBadge confidence={provenance.confidence} />}
      </label>
      {control}
      {error?.message && <div className="field-error">{error.message}</div>}
      {!error?.message && hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
