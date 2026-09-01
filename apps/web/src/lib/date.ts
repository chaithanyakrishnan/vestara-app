/**
 * `MM/DD/YYYY` formatting and parsing for the wizard's date fields, mirroring
 * the prototype's `dateTyping` / `isValidDate` helpers. Purely presentational —
 * the step schemas store dates as plain strings.
 */

const MAX_DIGITS = 8; // MMDDYYYY

/** Progressive: "03" → "03", "0301" → "03/01", "03012002" → "03/01/2002". */
export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, MAX_DIGITS);
  if (digits.length === 0) return "";
  let out = digits.slice(0, 2);
  if (digits.length >= 3) out += "/" + digits.slice(2, 4);
  if (digits.length >= 5) out += "/" + digits.slice(4, 8);
  return out;
}

/** True only for a complete, real calendar date — rejects 02/31, month 13, etc. */
export function isValidDate(value: string): boolean {
  if (!value || value.length !== 10) return false;
  const [m, d, y] = value.split("/").map(Number);
  if (!m || !d || !y || y < 1900 || y > 2100) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1 && dt.getDate() === d && dt.getFullYear() === y;
}

export function parseDate(value: string): { year: number; month: number; day: number } | null {
  if (!isValidDate(value)) return null;
  const [m, d, y] = value.split("/").map(Number);
  return { year: y, month: m - 1, day: d };
}

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateString = (year: number, month: number, day: number) =>
  `${pad(month + 1)}/${pad(day)}/${year}`;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
