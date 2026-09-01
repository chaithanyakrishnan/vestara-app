import fs from "fs";
import path from "path";
import { prisma } from "../../lib/prisma";
import { env } from "../../lib/env";
import { ApiError } from "../../middleware/error.middleware";
import {
  schemaForStep,
  STEP_KEYS,
  fieldLabel,
  stepLabel,
  type ContactGateInput,
  type VestingStepInput,
} from "@vestara/shared";
import { validateVestingAgainstPlan } from "./irsVestingFloor";
import { createSignatureRequests, sortSigners } from "../esign/esign.service";

function generateRefNumber(): string {
  return "VTR-" + Date.now().toString(36).toUpperCase().slice(-6);
}

/**
 * Dashboard row: the plan record plus a `summary` computed from its step data.
 *
 * The summary is built HERE rather than on the client for two reasons. The
 * dashboard needs fields from three different steps (identity, administration,
 * trustees_funds), and `administration` holds the employer's bank routing and
 * account numbers — shipping the raw step JSON for every plan would put those
 * in a list response that any authenticated caller can fetch. Sending only the
 * derived fields keeps them server-side. It is also the only place the
 * compliance figure can be honest: "complete" means the step re-validates
 * against its schema, the same check `validateReadyToSubmit` runs, not merely
 * that a row exists (AI extraction can write a partial section).
 */
function toPlanSummary(plan: {
  stepData: Array<{ stepKey: string; data: unknown }>;
  trustees: Array<{ name: string; type: string }>;
  signatures: Array<{ status: string }>;
  signatureName: string | null;
  _count: { documents: number };
  [k: string]: unknown;
}) {
  const byKey = new Map(plan.stepData.map((s) => [s.stepKey, s.data as any]));
  const identity = byKey.get("identity") ?? {};
  const administration = byKey.get("administration") ?? {};
  const funds = byKey.get("trustees_funds") ?? {};
  // Compliance is scored against the schema for THIS plan's type — a 401(a)
  // scored against the 401(k) shape would read as permanently incomplete.
  const planType = identity.planType as string | undefined;

  let completedSteps = 0;
  for (const key of STEP_KEYS) {
    const data = byKey.get(key);
    if (data === undefined) continue;
    // trustees_funds keeps its trustees in a normalized table, so the stored
    // JSON alone never satisfies the schema's trustee requirement — merge them
    // back in, exactly as validateReadyToSubmit does.
    const candidate =
      key === "trustees_funds"
        ? { ...data, trustees: plan.trustees.map((t) => ({ name: t.name, type: t.type })) }
        : data;
    if (schemaForStep(key, planType)!.safeParse(candidate).success) completedSteps++;
  }

  // Signature roll-up. Plans submitted under the old typed-signature flow have
  // a `signatureName` and no PlanSignature rows at all; treating that as
  // executed keeps them from reading as "awaiting signature" forever.
  const signed = plan.signatures.filter((sg) => sg.status === "signed").length;
  const sent = plan.signatures.filter((sg) => sg.status === "sent").length;
  const legacySigned = plan.signatures.length === 0 && !!plan.signatureName;
  const signatureStatus = legacySigned
    ? "signed"
    : plan.signatures.length === 0
      ? "none"
      : signed === plan.signatures.length
        ? "signed"
        : sent > 0
          ? "sent"
          : "pending";

  const { stepData, trustees, signatures, _count, ...rest } = plan;
  return {
    ...rest,
    summary: {
      planName: identity.planName ?? null,
      employerName: identity.employerName ?? null,
      employerEin: identity.employerEin ?? null,
      planNumber: identity.planNumber ?? null,
      planType: identity.planType ?? null,
      planStatus: identity.planStatus ?? "new",
      payrollProvider: identity.payrollProvider || null,
      previousRecordkeeper: identity.previousRecordkeeper || null,
      completedSteps,
      totalSteps: STEP_KEYS.length,
      compliancePct: Math.round((completedSteps / STEP_KEYS.length) * 100),
      fundCount: Array.isArray(funds.selectedFundTickers) ? funds.selectedFundTickers.length : 0,
      qdia: funds.qdia ?? null,
      trusteeType: funds.trusteeType ?? null,
      trusteeCount: trustees.length,
      // Who pays plan expenses and how — never the bank credentials themselves.
      planExpensePayer: administration.planExpensePayer ?? null,
      employerPaymentMethod: administration.employerPaymentMethod ?? null,
      documentCount: _count.documents,
      signatureStatus,
      signaturesSigned: legacySigned ? 1 : signed,
      signaturesTotal: legacySigned ? 1 : signatures.length,
    },
  };
}

export async function listPlansForUser(userId: string, role: "sponsor" | "advisor") {
  const plans = await prisma.plan.findMany({
    where: role === "sponsor" ? { sponsorUserId: userId } : { advisorUserId: userId },
    include: {
      contacts: true,
      signatures: true,
      stepData: true,
      trustees: true,
      _count: { select: { documents: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return plans.map(toPlanSummary);
}

export async function createPlanFromGate(
  sponsorUserId: string,
  advisorUserId: string | null,
  contact: ContactGateInput,
) {
  return prisma.plan.create({
    data: {
      refNumber: generateRefNumber(),
      sponsorUserId,
      advisorUserId,
      contacts: {
        // Mapped field by field rather than spread: the gate schema and the
        // PlanContact table deliberately use different names for the shared
        // columns (advisor.firm and sponsor.org both land in `org`;
        // advisor.fiduciary lands in `fiduciaryRole`). A spread silently
        // forwards the schema's names and Prisma rejects them at runtime —
        // TypeScript can't catch it, since excess-property checking doesn't
        // apply to spread properties.
        create: [
          {
            type: "advisor",
            name: contact.advisor.name,
            email: contact.advisor.email,
            phone: contact.advisor.phone,
            org: contact.advisor.firm,
            title: contact.advisor.title,
            fiduciaryRole: contact.advisor.fiduciary,
          },
          {
            type: "sponsor",
            name: contact.sponsor.name,
            email: contact.sponsor.email,
            phone: contact.sponsor.phone,
            org: contact.sponsor.org,
            title: contact.sponsor.title,
          },
          // A TPA row exists only when one was actually elected. `engaged`
          // itself is not stored — the presence of the row IS the election, so
          // un-ticking the box on a re-submit can't leave a stale TPA behind.
          // The firm goes in `org` (it is the party engaged); `name` is the
          // individual there, which may be blank.
          ...(contact.tpa?.engaged
            ? [
                {
                  type: "tpa",
                  name: contact.tpa.name || null,
                  email: contact.tpa.email || null,
                  phone: contact.tpa.phone || null,
                  org: contact.tpa.firm,
                  title: null,
                },
              ]
            : []),
        ],
      },
    },
    include: { contacts: true },
  });
}

export async function getPlan(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    // provenance is included so the "pre-filled from your document" banners can
    // render — without it plan.provenance is undefined on the client and every
    // AI banner silently no-ops.
    include: {
      contacts: true,
      signatures: true,
      stepData: true,
      trustees: true,
      documents: true,
      provenance: true,
    },
  });
  if (!plan) throw new ApiError(404, "Plan not found");
  // Prisma can't express the signing-order sort (it isn't alphabetical and no
  // column encodes it), so apply it here — the review and success screens both
  // render this list directly.
  return { ...plan, signatures: sortSigners(plan.signatures) };
}

/**
 * Validates `data` against the Zod schema registered for `stepKey` in
 * @vestara/shared, then upserts it. This is the single write path for every
 * wizard step (S1–S6 from the original prototype) — there is no separate
 * per-step controller branch, which is the point of the generic step table.
 */
export async function updateStep(planId: string, stepKey: string, data: unknown) {
  if (!STEP_KEYS.includes(stepKey as any)) {
    throw new ApiError(400, `Unknown step key: ${stepKey}`);
  }
  // Which schema applies depends on the plan type. When the identity step is
  // itself being written, the incoming payload is the authority — the user may
  // be changing the plan type right now. Otherwise read it from the stored
  // identity step.
  const planType =
    stepKey === "identity"
      ? (data as any)?.planType
      : await getPlanType(planId);

  const schema = schemaForStep(stepKey, planType)!;
  const parsed = schema.parse(data); // throws ZodError -> handled by errorHandler

  // Business rules that outlive a pure shape check live next to the write path,
  // not in the schema — see irsVestingFloor.ts for why. Vesting needs the
  // contribution elections too, so it reads them from the draft.
  if (stepKey === "vesting") {
    const contributions = await prisma.planStepData.findUnique({
      where: { planId_stepKey: { planId, stepKey: "contributions" } },
    });
    validateVestingAgainstPlan(parsed as VestingStepInput, planType, contributions?.data as any);
  }

  await prisma.planStepData.upsert({
    where: { planId_stepKey: { planId, stepKey } },
    create: { planId, stepKey, data: parsed as any },
    update: { data: parsed as any },
  });

  const stepIndex = STEP_KEYS.indexOf(stepKey as any);
  await prisma.plan.update({ where: { id: planId }, data: { currentStep: stepIndex } });
  await bumpMaxStepReached(planId, stepIndex);

  return parsed;
}

/** Only ever increases — this is what keeps later rail steps unlocked after the
 * user jumps back to edit an earlier one. Exported so AI extraction can unlock
 * the steps it successfully pre-filled (see extraction.service.ts). */
/**
 * Records ONLY the new-plan / transfer election, before the identity step is
 * filled in.
 *
 * This is a deliberate exception to "updateStep is the single write path": the
 * election is made on its own screen ahead of the wizard, and the identity
 * schema requires an EIN, plan name and plan year end that the user has not
 * reached yet, so a full `updateStep` would reject it. It merges one key into
 * the identity step rather than introducing a second home for the value —
 * `identity.planStatus` stays the single source of truth. (`applyExtractionToPlan`
 * writes partial sections the same way, for the same reason.)
 *
 * It does NOT advance currentStep/maxStepReached: choosing new-vs-transfer is
 * not completing the identity step.
 */
export async function setPlanStatus(planId: string, planStatus: "new" | "transfer") {
  const existing = await prisma.planStepData.findUnique({
    where: { planId_stepKey: { planId, stepKey: "identity" } },
  });
  const merged = { ...((existing?.data as object) ?? {}), planStatus };

  await prisma.planStepData.upsert({
    where: { planId_stepKey: { planId, stepKey: "identity" } },
    create: { planId, stepKey: "identity", data: merged as any },
    update: { data: merged as any },
  });
  return { planStatus };
}

export async function bumpMaxStepReached(planId: string, stepIndex: number) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  if (stepIndex > plan.maxStepReached) {
    await prisma.plan.update({ where: { id: planId }, data: { maxStepReached: stepIndex } });
  }
}

/**
 * Wipes every wizard answer on a plan, returning it to a blank draft.
 *
 * Backs "Enter Manually": the wizard hydrates from whatever is saved against
 * the plan, so without this an earlier AI extraction would still be sitting in
 * the fields of someone who explicitly chose to start from scratch.
 *
 * Contacts are deliberately NOT cleared — those were captured on the gate
 * before the intake choice and are not part of the plan design. Uploaded
 * Documents and their AiExtraction audit rows also survive: they record that a
 * document was read, which stays true even after the answers are discarded.
 */
export async function resetPlanDraft(planId: string) {
  // The new-plan / transfer election is made BEFORE the intake choice, on its
  // own screen, so "start fresh" must not silently discard it — the user would
  // land in the wizard having answered that question and find it blank.
  // Everything else the wizard collects is cleared.
  const identity = await prisma.planStepData.findUnique({
    where: { planId_stepKey: { planId, stepKey: "identity" } },
  });
  const planStatus = (identity?.data as any)?.planStatus;

  await prisma.$transaction([
    prisma.planStepData.deleteMany({ where: { planId } }),
    prisma.fieldProvenance.deleteMany({ where: { planId } }),
    prisma.planTrustee.deleteMany({ where: { planId } }),
    prisma.plan.update({
      where: { id: planId },
      data: { currentStep: 0, maxStepReached: 0, status: "draft", signatureName: null, submittedAt: null },
    }),
  ]);

  if (planStatus === "new" || planStatus === "transfer") {
    await setPlanStatus(planId, planStatus);
  }
  return getPlan(planId);
}

/**
 * Permanently deletes a DRAFT plan and everything hanging off it.
 *
 * Restricted to `status: "draft"` on purpose: once a plan is submitted, the
 * signature name, timestamp and the contacts that signed it are the record of
 * a legal election, and the API is the only place that invariant can be
 * enforced (the dashboard hides the button, but a hidden button is not a
 * check).
 *
 * Every child table declares `onDelete: Cascade`, so one `plan.delete` removes
 * contacts, step data, trustees, provenance, documents and their AiExtraction
 * rows. The uploaded FILES are not in the database, so they are unlinked here
 * first — best effort, because a missing file must not block the delete and
 * leave the row orphaned instead.
 */
export async function deletePlan(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { documents: true },
  });
  if (!plan) throw new ApiError(404, "Plan not found");
  if (plan.status !== "draft") {
    throw new ApiError(409, "Only draft plans can be deleted");
  }

  for (const doc of plan.documents) {
    try {
      fs.unlinkSync(path.join(env.uploadDir, doc.storageKey));
    } catch {
      /* already gone, or never written — the DB row still needs to go */
    }
  }

  await prisma.plan.delete({ where: { id: planId } });
  return { id: planId, refNumber: plan.refNumber };
}

export async function replaceTrustees(planId: string, trustees: Array<{ name: string; type: string }>) {
  await prisma.$transaction([
    prisma.planTrustee.deleteMany({ where: { planId } }),
    prisma.planTrustee.createMany({
      data: trustees.map((t) => ({ planId, name: t.name, type: t.type })),
    }),
  ]);
  return prisma.planTrustee.findMany({ where: { planId } });
}

/**
 * Validates that every wizard step has data and every hard business rule
 * (min 3 funds, at least 1 trustee, etc.) is satisfied before allowing
 * submission — this is the check the original HTML prototype never did.
 */
/**
 * The plan type drives which schema every other step is validated against, so
 * it is read from the stored identity step rather than passed around. A draft
 * with no identity step yet falls back to the 401(k) shape.
 */
/**
 * Turns a step's Zod issues into a sentence a plan sponsor can act on.
 *
 * The old form was `trustees_funds (namedFiduciary, fidelityBondAmount)` —
 * an error message written in variable names. Labels come from the shared
 * FIELD_LABELS so the wording matches what the field is called on screen.
 */
function describeIncompleteStep(stepKey: string, issues: Array<{ path: (string | number)[] }>): string {
  const fields = [...new Set(issues.map((i) => String(i.path[0] ?? "")).filter(Boolean))];
  if (fields.length === 0) return stepLabel(stepKey);
  return `${stepLabel(stepKey)} — ${fields.map(fieldLabel).join(", ")}`;
}

export async function getPlanType(planId: string): Promise<string | undefined> {
  const row = await prisma.planStepData.findUnique({
    where: { planId_stepKey: { planId, stepKey: "identity" } },
  });
  return (row?.data as any)?.planType;
}

export async function validateReadyToSubmit(planId: string) {
  const plan = await getPlan(planId);
  const byKey = new Map(plan.stepData.map((s) => [s.stepKey, s.data]));
  const planType = (byKey.get("identity") as any)?.planType as string | undefined;
  const missing: string[] = [];

  // Presence is not enough. AI extraction can now write a PARTIAL section when
  // a document was only partly readable (see extractionRecovery.ts), so a step
  // can hold data and still be missing required fields. Re-validating here is
  // what keeps that prefill-what-we-can behaviour from letting an incomplete
  // plan through — the user has to visit the step and finish it.
  for (const key of STEP_KEYS) {
    if (key === "trustees_funds") continue; // validated separately below (needs trustees table)
    const data = byKey.get(key);
    if (data === undefined) {
      missing.push(stepLabel(key));
      continue;
    }
    const result = schemaForStep(key, planType)!.safeParse(data);
    if (!result.success) missing.push(describeIncompleteStep(key, result.error.issues));
  }

  const trusteesFundsData = byKey.get("trustees_funds") as any;
  if (!trusteesFundsData) {
    missing.push(stepLabel("trustees_funds"));
  } else {
    // safeParse, not parse: a raw ZodError escapes as a 400 with an `issues`
    // array, which the review screen renders as "Submission failed" with no
    // detail. Folding it into `missing` keeps every incomplete step reported
    // the same way, in one 422 the user can act on.
    const result = schemaForStep("trustees_funds", planType)!.safeParse({
      ...trusteesFundsData,
      trustees: plan.trustees.map((t) => ({ id: t.id, name: t.name, type: t.type })),
    });
    if (!result.success) missing.push(describeIncompleteStep("trustees_funds", result.error.issues));
  }

  if (missing.length > 0) {
    throw new ApiError(
      422,
      `This plan can't be submitted yet. Please complete: ${missing.join("; ")}.`,
    );
  }
}

/**
 * Locks the plan and opens the e-signature round.
 *
 * There is no typed signature any more: execution happens in the e-sign
 * envelopes, not in a text box on the review screen, so "submitted" means
 * "elections final, signatures requested" rather than "signed". The plan is
 * fully executed only when every PlanSignature reaches "signed" — which is
 * what the dashboard reports.
 */
export async function submitPlan(planId: string) {
  await validateReadyToSubmit(planId);
  const current = await prisma.plan.findUniqueOrThrow({ where: { id: planId } });

  // Re-submitting an already-submitted plan must not rewrite submittedAt: that
  // timestamp is the record of when the elections were made final.
  const plan =
    current.status === "submitted"
      ? current
      : await prisma.plan.update({
          where: { id: planId },
          data: { status: "submitted", submittedAt: new Date() },
        });

  await createSignatureRequests(planId);
  return plan;
}
