import type { InputHTMLAttributes } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { formatPhoneNumber } from "../lib/phone";
import { useMaskedField } from "../hooks/useMaskedField";

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "onBlur" | "type"> & {
  /** The result of `register("some.phone")` — spread style matches every other
   * field in the app, so a phone field is still a one-liner at the call site. */
  registration: UseFormRegisterReturn;
};

/**
 * Phone field that rewrites itself into `(XXX) XXX-XXXX` as the user types.
 * Masking mechanics (caret anchoring, backspace-onto-separator, blur
 * normalization) live in useMaskedField / lib/mask.ts and are shared with
 * DateInput and EinInput.
 *
 * No `maxLength`: the formatter already caps at 10 digits, and a hard
 * maxLength would let the browser truncate a pasted "+1 (890) 950-4950"
 * before the country-code stripping in `phoneDigits` ever sees it.
 */
export function PhoneInput({ registration, ...inputProps }: PhoneInputProps) {
  const { registrationRest, handlers } = useMaskedField(registration, formatPhoneNumber);

  return (
    <input
      {...registrationRest}
      {...inputProps}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      {...handlers}
    />
  );
}
