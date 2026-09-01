import fs from "fs";
import path from "path";
import { prisma } from "../../lib/prisma";
import { env } from "../../lib/env";
import { ApiError } from "../../middleware/error.middleware";
import { MOCK_EXTRACTION } from "./mockExtraction";
import { schemaForStep, STEP_KEYS } from "@vestara/shared";
import { bumpMaxStepReached, getPlanType } from "../plans/plans.service";
import { normalizeSection, salvageSection } from "./extractionRecovery";

/**
 * The section keys here MUST match STEP_KEYS in @vestara/shared exactly —
 * applyExtractionToPlan looks each one up by step key, and anything it can't
 * find is skipped without comment. An earlier version asked for a top-level
 * "trustees" array instead of a "trustees_funds" section, so that step was
 * never populated on a real Claude call.
 */
/**
 * Guidance that only makes sense for one plan type. Kept out of the shared body
 * so a 403(b) is not read against 401(k) section headings and enums — the
 * recovery layer would otherwise salvage partial nonsense rather than reporting
 * that the document does not match the type the user selected.
 */
const PLAN_TYPE_GUIDANCE: Record<string, string> = {
  "401k":
    "This should be a 401(k) adoption agreement. Expect ADP/ACP safe harbor elections, " +
    "a vesting schedule for employer money, and a trust.",
  "403b":
    "This should be a 403(b) plan document. There is NO trustee — look for a custodian " +
    "(Section 403(b)(7) custodial account) or annuity issuer (Section 403(b)(1)). There is no ADP safe " +
    "harbor. Look for the universal availability statement and its permitted exclusions " +
    "(under 20 hours per week, students, employees eligible for another plan, non-resident " +
    "aliens), the 15-year service catch-up, and whether the plan is ERISA or non-ERISA.",
  "457b_gov":
    "This should be a governmental 457(b) plan. The annual limit is a SINGLE ceiling covering " +
    "employee deferrals and employer contributions together. Assets must be held in trust " +
    "(Section 457(g)). Look for the final-three-years catch-up. There is no ADP testing or safe harbor.",
  "457b_nongov":
    "This should be a non-governmental (top-hat) 457(b) plan. It must be UNFUNDED — do not " +
    "report a trust or trustee. There is no designated Roth account and no age-50 catch-up. " +
    "Look for the select-group eligibility description, the substantial risk of forfeiture, " +
    "and the unforeseeable emergency provision (not hardship).",
  "401a":
    "This should be a 401(a) employer-funded plan. There are NO elective deferrals — do not " +
    "report pretaxDeferrals or rothDeferrals as true. Look for the fixed or discretionary " +
    "employer contribution formula, and whether it is a money purchase or profit sharing plan.",
};

const EXTRACTION_PROMPT = `You are extracting retirement plan elections from an adoption
agreement or plan document PDF. Return ONLY a JSON object with these exact top-level keys, and no
prose before or after it. Use the exact enum values shown.

READ THE WHOLE DOCUMENT. The first page is usually a near-blank cover sheet
carrying only the plan title. Employer and Plan details are further in, and the
heading wording differs by provider. Look for whichever of these appears:

  - "ARTICLE I / DEFINITIONS", then numbered elections
    "1. EMPLOYER (1.24)"  -> Name, Address, "Phone number" = employerPhone,
                             "Taxpayer Identification Number (TIN)" = employerEin
    "2. PLAN (1.42)"      -> Name, "Plan number" (3-digit, for Form 5500),
                             "Name of Trust"
    "3. PLAN/LIMITATION YEAR" -> planYearEnd (e.g. a checked "December 31")
    "4. EFFECTIVE DATE (1.20)" -> "Initial Effective Date of Plan" =
                             originalEffectiveDate; "Restatement Effective Date"
                             (Election 4(d)) = restatedEffectiveDate. Report BOTH
                             when both are filled in — they are different dates.
    "5. TYPE OF PLAN"     -> planType
  - "EMPLOYER INFORMATION" / "Part A. Adopting Employer" ->
    "Name of Adopting Employer", "Adopting Employer's Federal Tax Identification
    Number" = employerEin, "Name of Plan", "Plan Sequence Number" = planNumber,
    "Telephone" = employerPhone. Under "SECTION ONE: EFFECTIVE DATES", Part A
    gives originalEffectiveDate; in Part B "The Initial Plan Document was
    effective on" is originalEffectiveDate and "The Effective Date of this
    amendment or restatement is" is restatedEffectiveDate.
  - An ADMINISTRATIVE CHECKLIST ("AC1. PLAN LOANS", "AC2. PARTICIPANT DIRECTION
    OF INVESTMENT", "AC3. ROLLOVER CONTRIBUTIONS", "AC4. PLAN EXPENSES",
    "AC12. TRUSTEE(S)") may follow the signature page. It is not part of the
    Adoption Agreement itself, but it is where loans, rollovers, who pays plan
    expenses, the Name of Trust and the named trustees are actually recorded —
    read it too.
  - The EXECUTION PAGE near the end repeats the employer's legal name, and the
    trustee section names the Trust — use them to confirm what you read earlier.

Elections are marked with a checked box, written "[X]". An unchecked "[ ]" was
NOT elected; do not report its value.

REQUIRED FIELDS. These must be present or the section is incomplete and the user
has to retype it: identity needs planType, employerName, employerEin, planName,
planNumber and planYearEnd. For a required field, give your best reading with a
low confidence score rather than omitting it. Omit an OPTIONAL field you cannot
find rather than guessing. If a blank is genuinely empty on the form (many
sample/template PDFs are entirely unfilled), omit it — do not invent a value.

FORMATS. Convert to these before returning:
  - employerEin: hyphenated "XX-XXXXXXX". The TIN is the EIN.
  - planNumber: exactly 3 digits, zero-padded ("1" -> "001").
  - dates: "MM/DD/YYYY". "January 1, 2019" -> "01/01/2019".
  - planYearEnd: the month and day the plan year ends, e.g. "December 31".
  - phone numbers: "(XXX) XXX-XXXX".

DOCUMENT TYPE CHECK. Report in "detectedPlanType" the plan type the document
actually is, read from its own title and elections — not the type you were told
to expect. If they disagree, still extract what you can and report both; the
mismatch is surfaced to the user rather than silently pre-filling the wizard.

planStatus: use "transfer" ONLY when the document shows assets moving from a
named prior recordkeeper or provider. An "amendment and restatement" of an
existing plan (Election 4(b) "Restated Plan", a Cycle 3 restatement) is NOT a
transfer — report it as "new" and put the restatement date in
originalEffectiveDate if no separate initial effective date is given. Put the
restatement date in restatedEffectiveDate, not in transferEffectiveDate.

{
  "detectedPlanType": "401k"|"403b"|"457b_gov"|"457b_nongov"|"401a",
  "identity": {
    "planType": "401k"|"403b"|"457b_gov"|"457b_nongov"|"401a",
    // 403(b) only:
    "erisaStatus": "erisa"|"non_erisa",
    "organizationType": "501c3"|"public_school"|"church"|"hospital"|"other",
    // 457(b) governmental only:
    "governmentalEntityType": "state"|"county"|"municipal"|"school_district"|"other",
    // 457(b) non-governmental only:
    "topHatCertified": boolean,
    // 401(a) only:
    "planSubtype": "money_purchase"|"profit_sharing",
    "employerName": string, "employerEin": "XX-XXXXXXX", "employerAddress": string,
    "employerPhone": "(XXX) XXX-XXXX",
    "planName": string, "planNumber": "NNN", "planYearEnd": string, "trustName": string,
    "planStatus": "new"|"transfer",
    "originalEffectiveDate": "MM/DD/YYYY", "restatedEffectiveDate": "MM/DD/YYYY",
    "transferEffectiveDate": "MM/DD/YYYY",
    "previousRecordkeeper": string,        // REQUIRED when planStatus is "transfer"
    "previousRecordkeeperContact": string, "previousRecordkeeperPhone": "(XXX) XXX-XXXX",
    "previousRecordkeeperEmail": string, "approxAssetsTransferring": number,
    "payrollProvider": string
  },
  "contributions": {
    "pretaxDeferrals": boolean, "rothDeferrals": boolean,   // at least one must be true
    "catchupPermitted": "yes"|"no", "catchupMatched": "yes"|"no",
    "safeHarborElected": boolean, "safeHarborType": "basic"|"enhanced"|"ne"|"qaca",
    "safeHarborPeriod": "payroll"|"monthly"|"annual", "safeHarborAppliesTo": string,
    // The safe harbor FORMULA, not just its name. Basic = 100% on the first 3%
    // plus 50% on the next 2%; non-elective is a minimum of 3%.
    "safeHarborMatchTier1Pct": number, "safeHarborMatchTier1UpToPct": number,
    "safeHarborMatchTier2Pct": number, "safeHarborMatchTier2UpToPct": number,
    "safeHarborNonelectivePct": number,
    "superCatchupPermitted": "yes"|"no",       // ages 60-63
    "service15CatchupPermitted": "yes"|"no",   // 403(b) only
    "final3CatchupPermitted": "yes"|"no",      // 457(b) only
    // Definition of compensation — usually its own numbered election.
    "compensationDefinition": "w2"|"3401a"|"415_safe_harbor",
    "compensationExclusions": ["bonus"|"overtime"|"commissions"|"fringe"|"severance"],
    "compensationPostSeverance": "include"|"exclude",
    "adpTestMethod": "current"|"prior",
    "topHeavyMinimumBy": "employer"|"not_applicable",
    "matchElected": boolean, "matchType": "disc"|"fixed", "matchPct": number, "matchCapPct": number,
    "nonelectiveElected": boolean, "nonelectiveType": "disc"|"fixed", "nonelectivePct": number,
    "nonelectiveAllocation": "prorata"|"integrated"|"grouped",
    "nonelectiveCondition": "lastday"|"1000hrs"|"none",
    "forfeitureUse": "reduce_ne"|"reduce_match"|"pay_expenses"|"reallocate"
  },
  "eligibility": {
    "minimumAge": "none"|"18"|"20.5"|"21",
    "serviceRequirement": "none"|"3mo"|"6mo"|"1yr"|"2yr",
    "entryDates": "immediate"|"monthly"|"quarterly"|"semi"|"annual",
    "hoursOfServiceMethod": "actual"|"elapsed"|"split",
    "excludeUnion": boolean, "excludeNonResidentAliens": boolean,
    "excludePartTime": boolean, "excludeHce": boolean,
    "ltptTrackingAcknowledged": boolean,
    "deferralServiceRequirement": "none"|"3mo"|"6mo"|"1yr",
    "uaExclusions": ["under_20_hours"|"students"|"other_plan_eligible"|"nonresident_aliens"],
    "eligibleClassDescription": string,        // 457(b) non-governmental top-hat group
    "eacaPermissibleWithdrawal": boolean,
    "autoEnrollElected": boolean, "autoEnrollType": "eaca"|"qaca"|"basic",
    "autoEnrollDefaultPct": number, "autoEnrollEscalation": "none"|"1pct_yr"|"2pct_yr",
    "autoEnrollEscalationCap": number
  },
  "vesting": {
    "scheduleType": "imm"|"3cliff"|"6graded"|"custom",
    // REQUIRED when scheduleType is "custom"; final row must be exactly 100
    "customSchedule": [{ "yearLabel": string, "pct": number }],
    "matchVesting": "imm"|"3cliff"|"6graded",
    "nonelectiveVesting": "imm"|"3cliff"|"6graded",
    "safeHarborVesting": "imm"|"2cliff",
    "substantialRiskOfForfeiture": "none"|"service"|"performance",  // 457(b) non-gov
    "normalRetirementAge": "60"|"62"|"65"|"sscra",
    "vestingOnDeathDisability": "none"|"death"|"disability"|"both"
  },
  "administration": {
    "loansPermitted": boolean, "loanMinAmount": number,   // amount REQUIRED if loans permitted
    "loanMaxOutstanding": "1"|"2"|"unlimited",
    "loanInterestRate": "prime"|"prime1"|"prime2", "loanPurpose": "any"|"principal_residence_only",
    "loanMaxBasis": "statutory"|"lesser_of_50pct"|"custom",
    "loanGeneralMaxTermYears": number,   // five years max under Section 72(p)(2)(B)
    "loanHomeMaxTermYears": number, "loanRefinancing": "allowed"|"not_allowed",
    "loanAcceleration": "on_termination"|"never", "loanPaymentsOnLeave": "suspend"|"continue",
    "inServiceAt59_5": boolean, "hardshipElected": boolean, "hardshipType": "safe"|"non",
    "hardshipSelfCertification": boolean,
    "unforeseeableEmergencyElected": boolean,   // 457(b) equivalent of hardship
    "requiredBeginningAge": "73"|"75",
    "emergencyExpenseWithdrawal": boolean, "domesticAbuseWithdrawal": boolean,
    "birthAdoptionWithdrawal": boolean, "inPlanRothConversion": boolean,
    "inServiceFromRollover": boolean,
    "rolloversAccepted": boolean, "rolloverSources": "all"|"qualified_only"|"none",
    "planExpensePayer": "plan"|"employer",
    "employerPaymentMethod": "ach"|"check"|"wire", "employerPaymentBankName": string,
    "employerPaymentAccountType": "checking"|"savings"
  },
  "trustees_funds": {
    "trustees": [{ "name": string, "type": "Individual"|"Corporate" }],  // at least 1
    "trusteeType": "disc"|"dir",
    "custodianName": string,             // 403(b): custodian or annuity issuer, NOT a trustee
    "selectedFundTickers": [string],
    "qdia": "target"|"balanced"|"managed",
    "claims404c": boolean,
    "planAdministratorIsEmployer": boolean, "planAdministratorName": string,
    "namedFiduciary": string, "agentForServiceOfProcess": string,
    "fidelityBondCarrier": string, "fidelityBondAmount": number
  },
  "trustees": [{ "name": string, "type": "Individual"|"Corporate" }]
}

Additionally, include a "_confidence" key inside EACH section object: a map from
that section's field names to a number between 0 and 1 saying how confident you
are that you read the value correctly from the document.

  1.0  = the value is stated explicitly and unambiguously in the document
  0.7  = you inferred it from related wording
  0.4  = you guessed from context
  Omit the field entirely rather than reporting confidence below ~0.3.

Example: "identity": { "employerName": "Acme Inc", "planNumber": "001",
"_confidence": { "employerName": 0.99, "planNumber": 0.62 } }

Be honest and calibrated — a low score is far more useful than a confident
wrong answer, because the reviewer uses these scores to decide what to check.`;

export async function saveUploadedDocument(
  planId: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
  const storageKey = `${planId}-${Date.now()}-${file.originalname}`;
  fs.writeFileSync(path.join(env.uploadDir, storageKey), file.buffer);

  return prisma.document.create({
    data: {
      planId,
      filename: file.originalname,
      storageKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    },
  });
}

/**
 * Runs extraction against the uploaded document and records both the raw
 * model output (AiExtraction) and a FieldProvenance row per top-level
 * section, so every prefilled field can later be traced to this run.
 * Falls back to MOCK_EXTRACTION when no Anthropic API key is configured —
 * this keeps the whole upload->parse->prefill flow runnable with zero
 * external dependencies in a plain dev environment.
 */
export async function runExtraction(documentId: string) {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new ApiError(404, "Document not found");

  const { parsed, modelName } = env.anthropicApiKey
    ? await extractWithClaude(document.storageKey, await getPlanType(document.planId))
    : { parsed: MOCK_EXTRACTION, modelName: "mock-fallback (no ANTHROPIC_API_KEY set)" };

  const extraction = await prisma.aiExtraction.create({
    data: { documentId, model: modelName, rawOutput: parsed as any },
  });

  const { writtenSections, skippedSections, partialSections } = await applyExtractionToPlan(
    document.planId,
    parsed,
    extraction.id,
  );

  return { extraction, parsed, writtenSections, skippedSections, partialSections };
}

/**
 * Each extracted section is safe-parsed against the SAME Zod schema the
 * manual wizard form uses — a section only lands in PlanStepData (and gets
 * an "ai" provenance row) if it actually passes validation. A section that
 * fails (e.g. the model returned a field the schema doesn't recognize) is
 * reported back as `skippedSections` rather than silently corrupting the
 * draft — this is the guardrail the original static prototype had no way
 * to enforce, since it just wrote AI output straight into the DOM.
 */
export type ConfidenceMap = Record<string, number>;

/**
 * Separates a section's values from the `_confidence` map the model emits
 * alongside them. Confidence is deliberately a sibling key rather than being
 * folded into each value ({value, confidence}) so the section still validates
 * against the unmodified step schema.
 */
export function splitConfidence(rawSection: unknown): {
  data: unknown;
  confidences: ConfidenceMap | null;
} {
  if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) {
    return { data: rawSection, confidences: null };
  }
  const { _confidence, ...data } = rawSection as Record<string, unknown>;
  if (!_confidence || typeof _confidence !== "object") return { data, confidences: null };

  // Keep only clean 0..1 numbers — a model can return a string, null, or 95.
  const confidences: ConfidenceMap = {};
  for (const [field, value] of Object.entries(_confidence as Record<string, unknown>)) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n >= 0 && n <= 1) confidences[field] = n;
  }
  return { data, confidences: Object.keys(confidences).length ? confidences : null };
}

function meanConfidence(confidences: ConfidenceMap | null): number | null {
  if (!confidences) return null;
  const values = Object.values(confidences);
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function applyExtractionToPlan(planId: string, parsed: Record<string, unknown>, extractionId: string) {
  // Sections are validated against the schema for the plan's OWN type. The
  // extraction may name a type in its identity section (a fresh draft has none
  // stored yet), so prefer that and fall back to what the plan already records.
  const planType =
    (parsed.identity as any)?.planType ?? (await getPlanType(planId));

  const writtenSections: string[] = [];
  const skippedSections: Array<{ section: string; reason: string }> = [];
  const partialSections: Array<{ section: string; missingFields: string[]; droppedFields: string[] }> = [];
  let highestStepWritten = -1;

  for (const stepKey of STEP_KEYS) {
    const rawSection = parsed[stepKey];
    if (rawSection === undefined) continue;

    // `_confidence` travels alongside the values but is NOT part of the step
    // schema, so it has to come off before validation or every section fails.
    const { data: sectionData, confidences } = splitConfidence(rawSection);

    const schema = schemaForStep(stepKey, planType)!;
    // Reformat before validating (prose dates, un-hyphenated TINs, "1" for a
    // plan number), then validate field by field so one unreadable field can't
    // discard every field that WAS read. See extractionRecovery.ts.
    const salvaged = salvageSection(schema, normalizeSection(stepKey, sectionData));

    if (Object.keys(salvaged.data).length === 0) {
      skippedSections.push({ section: stepKey, reason: "nothing in this section could be read" });
      continue;
    }

    await prisma.planStepData.upsert({
      where: { planId_stepKey: { planId, stepKey } },
      create: { planId, stepKey, data: salvaged.data as any },
      update: { data: salvaged.data as any },
    });

    const provenance = {
      source: "ai",
      extractionId,
      confirmedAt: null,
      confidence: meanConfidence(confidences),
      fieldConfidences: (confidences ?? {}) as any,
    };
    await prisma.fieldProvenance.upsert({
      where: { planId_fieldPath: { planId, fieldPath: stepKey } },
      create: { planId, fieldPath: stepKey, ...provenance },
      update: provenance,
    });
    writtenSections.push(stepKey);
    if (!salvaged.complete) {
      partialSections.push({
        section: stepKey,
        missingFields: salvaged.missingFields,
        droppedFields: salvaged.droppedFields,
      });
    }
    highestStepWritten = Math.max(highestStepWritten, STEP_KEYS.indexOf(stepKey));
  }

  // Unlock the rail up to the furthest step we pre-filled. Without this the
  // plan stays at maxStepReached 0, WizardLayout locks every step after the
  // first, and the sections that DID extract are invisible and unreachable —
  // which is precisely what "the document isn't reading fully" looked like.
  if (highestStepWritten >= 0) {
    await bumpMaxStepReached(planId, highestStepWritten);
  }

  if (Array.isArray(parsed.trustees) && parsed.trustees.length) {
    await prisma.$transaction([
      prisma.planTrustee.deleteMany({ where: { planId } }),
      prisma.planTrustee.createMany({
        data: (parsed.trustees as Array<{ name: string; type?: string }>).map((t) => ({
          planId,
          name: t.name,
          type: t.type ?? "Individual",
        })),
      }),
    ]);
    writtenSections.push("trustees");
  }

  return { writtenSections, skippedSections, partialSections };
}

/** Kept as a named constant so the model in use is reported back in the
 * AiExtraction audit row and can be changed in exactly one place. */
const MODEL = "claude-sonnet-4-6";

async function extractWithClaude(
  storageKey: string,
  planType?: string,
): Promise<{ parsed: typeof MOCK_EXTRACTION; modelName: string }> {
  // Kept isolated behind this function on purpose: swapping providers, adding
  // a queue/worker, or adding retries only ever touches this one function.
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: env.anthropicApiKey! });
  const filePath = path.join(env.uploadDir, storageKey);
  const pdfBase64 = fs.readFileSync(filePath).toString("base64");

  const response = await client.messages.create({
    model: MODEL,
    // The full six-section payload is a few thousand tokens of JSON on a real
    // adoption agreement. The previous 4,000 cap could truncate mid-object, and
    // a truncated response fails JSON.parse — another way the document appears
    // "not read fully".
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          // The document block must precede the instruction text.
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
          {
            type: "text",
            text: planType && PLAN_TYPE_GUIDANCE[planType]
              ? `${EXTRACTION_PROMPT}\n\nEXPECTED PLAN TYPE: ${planType}. ${PLAN_TYPE_GUIDANCE[planType]}`
              : EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    throw new ApiError(502, "The document was too long to read in one pass. Try a smaller PDF.");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const rawText = textBlock && "text" in textBlock ? textBlock.text : "{}";
  // Models sometimes wrap the object in a fence or a sentence of preamble.
  // Stripping fences alone still leaves "Here is the JSON:" in front of the
  // brace, so take the outermost {...} span instead — a whole document's worth
  // of extraction should not be lost to a conversational opener.
  const stripped = rawText.replace(/```json|```/g, "").trim();
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  const jsonText = first >= 0 && last > first ? stripped.slice(first, last + 1) : stripped;
  let parsed: typeof MOCK_EXTRACTION;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Surfacing this as a real error beats writing an empty draft and letting
    // the user discover the blank wizard for themselves.
    throw new ApiError(502, "The model returned a response that could not be parsed as JSON.");
  }
  return { parsed, modelName: MODEL };
}

export async function confirmField(planId: string, fieldPath: string) {
  return prisma.fieldProvenance.update({
    where: { planId_fieldPath: { planId, fieldPath } },
    data: { confirmedAt: new Date() },
  });
}
