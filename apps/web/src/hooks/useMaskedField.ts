import { useRef, useCallback } from "react";
import type { ChangeEvent, FocusEvent } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { applyDigitMask } from "../lib/mask";

/**
 * Wraps a react-hook-form registration so the field formats itself as the user
 * types. Returns handlers to spread onto an `<input>`; see lib/mask.ts for why
 * the field stays uncontrolled.
 *
 * Used by PhoneInput, DateInput and EinInput — the only difference between them
 * is the `format` function.
 */
export function useMaskedField(
  registration: UseFormRegisterReturn,
  format: (digits: string) => string,
) {
  const { onChange, onBlur, ...rest } = registration;
  // The field's value as of the previous keystroke, for the backspace-onto-
  // separator heuristic in applyDigitMask.
  const previousValue = useRef("");

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const inputType = (event.nativeEvent as InputEvent).inputType ?? "";
      previousValue.current = applyDigitMask(
        event.target,
        inputType,
        previousValue.current,
        format,
      );
      return onChange(event);
    },
    [onChange, format],
  );

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      // Catches values that arrived without keystrokes — autofill, or a value
      // pre-filled from an AI extraction that the user then tabbed past.
      const formatted = format(event.target.value);
      event.target.value = formatted;
      previousValue.current = formatted;
      return onBlur(event);
    },
    [onBlur, format],
  );

  const handleFocus = useCallback((event: FocusEvent<HTMLInputElement>) => {
    // Keep the backspace heuristic honest when the field was populated
    // programmatically rather than by typing.
    previousValue.current = event.target.value;
  }, []);

  /** Call after setting the input's value imperatively (e.g. a calendar pick). */
  const syncPrevious = useCallback((value: string) => {
    previousValue.current = value;
  }, []);

  return {
    registrationRest: rest,
    handlers: { onChange: handleChange, onBlur: handleBlur, onFocus: handleFocus },
    syncPrevious,
  };
}
