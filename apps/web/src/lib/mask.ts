/**
 * Shared machinery for digit-masked inputs — phone, date and EIN all format
 * themselves as the user types, and all three need the same three behaviours
 * that a naive "reformat on change" gets wrong:
 *
 *   1. The caret must stay anchored to the DIGIT it was next to, not to a
 *      string offset, or editing mid-value flings it to the end every keystroke.
 *   2. Backspacing onto a separator (the ")" in "(890)|", the "/" in "03/|")
 *      deletes a character the formatter instantly restores, so the key looks
 *      dead. That case has to eat the digit in front instead.
 *   3. Values that arrive without keystrokes — autofill, an AI pre-fill, a
 *      calendar pick — need formatting on blur/focus too.
 *
 * Inputs stay UNCONTROLLED: the handler rewrites `event.target.value` before
 * handing the event to react-hook-form, so RHF records the formatted string
 * without a re-render per keystroke.
 */

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

/**
 * Offset that sits just after the Nth digit of `formatted`. Clamps to the end
 * when there are fewer than N digits (e.g. after truncation).
 */
export function caretPositionAfterDigit(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

/**
 * Reformats `input` in place and re-anchors the caret. Returns the new value so
 * the caller can track it for the next backspace comparison.
 *
 * @param previousValue the field's value as of the previous keystroke — used to
 *   tell "backspaced a digit" apart from "backspaced a separator"
 * @param format maps a bare digit string to the display format
 */
export function applyDigitMask(
  input: HTMLInputElement,
  inputType: string,
  previousValue: string,
  format: (digits: string) => string,
): string {
  const raw = input.value;
  const caret = input.selectionStart ?? raw.length;

  let before = digitsOnly(raw.slice(0, caret));
  const after = digitsOnly(raw.slice(caret));

  if (
    inputType === "deleteContentBackward" &&
    before.length > 0 &&
    digitsOnly(raw).length === digitsOnly(previousValue).length
  ) {
    before = before.slice(0, -1);
  }

  const formatted = format(before + after);
  input.value = formatted;

  const position = caretPositionAfterDigit(formatted, before.length);
  // Guarded: setSelectionRange throws on inputs that don't support selection
  // (and is a no-op cost when the field isn't focused).
  try {
    input.setSelectionRange(position, position);
  } catch {
    /* not a selectable input — the reformat still applied */
  }

  return formatted;
}
