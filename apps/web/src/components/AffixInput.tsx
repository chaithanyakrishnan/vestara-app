import type { InputHTMLAttributes } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

type AffixInputProps = InputHTMLAttributes<HTMLInputElement> & {
  registration: UseFormRegisterReturn;
  /** Leading symbol, e.g. "$". */
  prefix?: string;
  /** Trailing symbol, e.g. "%". */
  suffix?: string;
};

/**
 * Input with a non-editable `$` prefix or `%` suffix rendered inside the field,
 * as the prototype did. The affix is decorative — it never becomes part of the
 * value, so the numeric schemas still receive a bare number.
 */
export function AffixInput({ registration, prefix, suffix, className, ...inputProps }: AffixInputProps) {
  const classes = [
    className,
    prefix ? "with-prefix" : null,
    suffix ? "with-suffix" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="input-wrap">
      {prefix && <span className="input-prefix">{prefix}</span>}
      <input {...registration} {...inputProps} className={classes || undefined} />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </div>
  );
}
