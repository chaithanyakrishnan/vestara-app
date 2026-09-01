import { z } from "zod";

/**
 * Makes model output survivable.
 *
 * Two failure modes were losing whole sections of real adoption agreements:
 *
 * 1. FORMAT. The documents state values the way a lawyer writes them —
 *    "January 1, 2019", "December 31", TIN "45-4071251", plan number "001".
 *    The step schemas want MM/DD/YYYY and a hyphenated EIN. A model that reads
 *    the value correctly but reports it verbatim used to fail validation.
 *
 * 2. ALL-OR-NOTHING VALIDATION. `schema.safeParse(section)` is a single
 *    verdict: one missing required field discarded every other field the model
 *    read. On the Avantax samples, "Restated Plan" maps naturally onto
 *    planStatus "transfer", the document names no prior recordkeeper, and
 *    IdentityStepSchema's superRefine then dropped all ten identity fields —
 *    employer name, EIN, address, plan name and number included. That is
 *    exactly the reported "can't extract Employer and Plan information".
 *
 * normalizeSection fixes (1); salvageSection fixes (2) by keeping every field
 * that validates on its own and reporting what could not be kept.
 */

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

/**
 * "January 1, 2019" / "1/1/2019" / "2019-01-01" -> "01/01/2019".
 * Returns the input untouched when it isn't a recognizable date, so a value we
 * don't understand is still handed to the schema rather than destroyed here.
 */
export function normalizeDate(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const raw = value.trim();
  if (!raw) return raw;

  const words = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (words) {
    const mm = MONTHS[words[1].toLowerCase()];
    if (mm) return `${mm}/${words[2].padStart(2, "0")}/${words[3]}`;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;

  const slashed = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashed) return `${slashed[1].padStart(2, "0")}/${slashed[2].padStart(2, "0")}/${slashed[3]}`;

  return raw;
}

/** "45-4071251", "454071251", "45 4071251" -> "45-4071251". */
export function normalizeEin(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const digits = value.replace(/\D/g, "");
  return digits.length === 9 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : value.trim();
}

/** "1", "01", "001 (3-digit number for Form 5500)" -> "001". */
export function normalizePlanNumber(value: unknown): unknown {
  if (typeof value === "number") return String(value).padStart(3, "0");
  if (typeof value !== "string") return value;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 && digits.length <= 3 ? digits.padStart(3, "0") : value.trim();
}

/** Strips "$", commas and "approximately" off a money-ish string. */
function normalizeMoney(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const cleaned = value.replace(/[$,\s]|approx(imately)?\.?/gi, "");
  return cleaned === "" ? undefined : cleaned;
}

const DATE_FIELDS = new Set(["originalEffectiveDate", "restatedEffectiveDate", "transferEffectiveDate"]);
const PHONE_FIELDS = new Set(["employerPhone", "previousRecordkeeperPhone"]);

/**
 * "815-223-6013" / "(815) 223-6013" / "8152236013" -> "(815) 223-6013", the
 * shape PhoneInput hydrates from. Anything that is not 10 digits is left as-is.
 */
export function normalizePhone(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const digits = value.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : value.trim();
}

/**
 * Per-section value cleanup applied BEFORE validation.
 *
 * The planStatus rule matters most: every sample we have is an "amendment and
 * restatement" of an existing plan, which a model reasonably reads as "not a
 * new plan" and reports as "transfer". A restatement is not a recordkeeper
 * transfer — nobody is moving assets, and the document names no prior provider.
 * Left alone it trips the superRefine and costs the entire identity section, so
 * a "transfer" with no named prior recordkeeper is corrected to "new" here.
 */
/**
 * The plan-year-end select stores short labels ("Dec 31"); the document — and
 * therefore the model — says "December 31". An unmatched value makes the
 * <select> render blank, so a correctly-read election looked unread. Map to the
 * app's canonical short form; leave anything we don't recognise untouched.
 */
export function normalizePlanYearEnd(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const raw = value.trim();
  const words = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?$/);
  if (words) {
    const key = words[1].toLowerCase();
    const month = Object.keys(MONTHS).find((m) => m.startsWith(key.slice(0, 3)));
    if (month) return `${month[0].toUpperCase()}${month.slice(1, 3)} ${Number(words[2])}`;
  }
  const numeric = raw.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (numeric) {
    const month = Object.entries(MONTHS).find(([, mm]) => Number(mm) === Number(numeric[1]));
    if (month) return `${month[0][0].toUpperCase()}${month[0].slice(1, 3)} ${Number(numeric[2])}`;
  }
  return raw;
}

export function normalizeSection(stepKey: string, raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const data = { ...(raw as Record<string, unknown>) };

  // Treat a blank/whitespace string as "not present" everywhere. Blank template
  // PDFs (the Ascensus SAMPLE) are full of these, and "" fails min(1) on a
  // required field just as loudly as a wrong value would.
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && value.trim() === "") delete data[key];
  }

  if (stepKey === "identity") {
    for (const field of DATE_FIELDS) {
      if (field in data) data[field] = normalizeDate(data[field]);
    }
    for (const field of PHONE_FIELDS) {
      if (field in data) data[field] = normalizePhone(data[field]);
    }
    if ("employerEin" in data) data.employerEin = normalizeEin(data.employerEin);
    if ("planNumber" in data) data.planNumber = normalizePlanNumber(data.planNumber);
    if ("planYearEnd" in data) data.planYearEnd = normalizePlanYearEnd(data.planYearEnd);
    if ("approxAssetsTransferring" in data) {
      const money = normalizeMoney(data.approxAssetsTransferring);
      if (money === undefined) delete data.approxAssetsTransferring;
      else data.approxAssetsTransferring = money;
    }
    if (data.planStatus === "transfer" && !data.previousRecordkeeper) {
      data.planStatus = "new";
    }
  }

  return data;
}

/** Walks ZodEffects/ZodDefault/ZodOptional wrappers down to the ZodObject. */
function innerObject(schema: z.ZodTypeAny): z.ZodObject<z.ZodRawShape> | null {
  let current: any = schema;
  for (let depth = 0; depth < 10 && current; depth++) {
    if (current instanceof z.ZodObject) return current;
    if (current?._def?.schema) current = current._def.schema; // ZodEffects (superRefine)
    else if (current?._def?.innerType) current = current._def.innerType; // ZodDefault/Optional
    else return null;
  }
  return null;
}

export type SalvageResult = {
  /** Everything that validated — parsed output when complete, kept raw values when not. */
  data: Record<string, unknown>;
  /** Fields the model supplied that failed their own field schema. */
  droppedFields: string[];
  /** Fields the section still needs before it can be submitted. */
  missingFields: string[];
  /** True when the whole section passed its step schema unmodified. */
  complete: boolean;
};

/**
 * Validates a section field by field so a partial read still lands in the draft.
 *
 * The user's alternative is re-typing the fifty fields the parser read correctly
 * because one of them was unreadable, so a partial prefill they can finish is
 * strictly better than a blank form — provided we say so. The caller reports
 * `missingFields`, the review screen shows them, and `validateReadyToSubmit`
 * re-validates every stored section, so an incomplete section can never reach
 * submission unnoticed.
 */
export function salvageSection(schema: z.ZodTypeAny, raw: unknown): SalvageResult {
  const empty: SalvageResult = { data: {}, droppedFields: [], missingFields: [], complete: false };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;

  const full = schema.safeParse(raw);
  if (full.success) {
    return { data: full.data as Record<string, unknown>, droppedFields: [], missingFields: [], complete: true };
  }

  const object = innerObject(schema);
  if (!object) return empty; // not an object schema — nothing to salvage field-wise

  const shape = object.shape as Record<string, z.ZodTypeAny>;
  const kept: Record<string, unknown> = {};
  const droppedFields: string[] = [];

  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    const fieldSchema = shape[field];
    if (!fieldSchema) continue; // unknown key — Zod would strip it anyway
    const parsed = fieldSchema.safeParse(value);
    if (parsed.success) kept[field] = parsed.data;
    else droppedFields.push(field);
  }

  // The survivors may now satisfy the whole schema (e.g. the only problem was a
  // single malformed optional field).
  const retry = schema.safeParse(kept);
  if (retry.success) {
    return { data: retry.data as Record<string, unknown>, droppedFields, missingFields: [], complete: true };
  }

  const missingFields = [
    ...new Set(
      retry.error.issues
        .map((issue) => String(issue.path[0] ?? ""))
        .filter((field) => field && !(field in kept)),
    ),
  ];

  return { data: kept, droppedFields, missingFields, complete: false };
}
