/**
 * US phone formatting for the `(XXX) XXX-XXXX` shape that the `phoneRegex` in
 * @vestara/shared's contact schema validates against. Kept in the web app
 * rather than in @vestara/shared on purpose: this is input presentation, not
 * part of the API contract — the schema stays the sole authority on what a
 * *valid* stored phone number looks like.
 */

import { caretPositionAfterDigit } from "./mask";

const MAX_DIGITS = 10;

// Re-exported for the existing phone call sites; the implementation moved to
// lib/mask.ts when date and EIN masking started sharing it.
export { caretPositionAfterDigit };

/** Strips everything but digits, and drops a leading US country code so a
 * pasted "+1 (890) 950-4950" or "18909504950" doesn't lose its last digit to
 * the 10-digit truncation below. */
export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length > MAX_DIGITS && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, MAX_DIGITS);
}

/**
 * Formats however many digits are present so far, progressively:
 * "" → "", "890" → "(890", "890950" → "(890) 950", "8909504950" → "(890) 950-4950".
 * Partial input is never padded — the user only ever sees the separators their
 * own digits have earned.
 */
export function formatPhoneNumber(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
