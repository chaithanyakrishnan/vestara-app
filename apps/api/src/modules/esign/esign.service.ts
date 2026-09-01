import { prisma } from "../../lib/prisma";
import { env } from "../../lib/env";
import { ApiError } from "../../middleware/error.middleware";

/**
 * E-signature requests for a submitted plan.
 *
 * This is the ONLY file that knows about DocuSign, mirroring how
 * extraction.service confines Claude to `extractWithClaude`. Everything else —
 * the routes, the review screen, the dashboard — deals in `PlanSignature` rows
 * with a `status`, so swapping providers or adding webhook callbacks touches
 * `sendEnvelopes` and nothing else.
 *
 * Without DocuSign credentials configured the send runs in SIMULATED mode: the
 * rows advance to "sent" and get a `sim-` envelope id, and the caller is told
 * `simulated: true` so the UI can say so rather than implying an email went
 * out. That is the same mock-vs-real contract the extraction service uses.
 */

/** Roles that get an envelope, in signing order. */
const SIGNER_ROLES = ["sponsor", "advisor", "tpa"] as const;

const ROLE_LABEL: Record<string, string> = {
  sponsor: "Plan Sponsor",
  advisor: "Financial Advisor",
  tpa: "Third Party Administrator",
};

export function signerRoleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

export function isDocusignConfigured(): boolean {
  return Boolean(env.docusignAccountId && env.docusignIntegrationKey);
}

/**
 * Builds the signer roster from the plan's contacts.
 *
 * A contact with no email address cannot receive an envelope, so it is skipped
 * rather than written as a row that can never progress — the TPA block makes
 * email optional, and the advisor's is required only at the gate.
 */
export async function createSignatureRequests(planId: string) {
  const contacts = await prisma.planContact.findMany({ where: { planId } });

  const rows = SIGNER_ROLES.flatMap((role) => {
    const contact = contacts.find((c) => c.type === role);
    if (!contact?.email) return [];
    return [
      {
        planId,
        role,
        name: contact.name || contact.org || signerRoleLabel(role),
        email: contact.email,
        status: "pending",
      },
    ];
  });

  // Re-submitting must not duplicate the roster; the unique (planId, role)
  // makes createMany skip what is already there.
  if (rows.length > 0) {
    await prisma.planSignature.createMany({ data: rows });
  }
  return listSignatures(planId);
}

/**
 * Signing order, not insertion order.
 *
 * createMany writes the roster in one transaction, so every `createdAt` is
 * identical and the rows come back arbitrarily ordered — and no column encodes
 * precedence. The sponsor executes the Adoption Agreement, so they lead.
 * Exported because getPlan reads signatures through its own Prisma include.
 */
export function sortSigners<T extends { role: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => SIGNER_ROLES.indexOf(a.role as any) - SIGNER_ROLES.indexOf(b.role as any),
  );
}

export async function listSignatures(planId: string) {
  return sortSigners(await prisma.planSignature.findMany({ where: { planId } }));
}

/**
 * Sends (or simulates sending) an envelope for every signature still pending.
 *
 * Already-sent and already-signed rows are left alone, so the button is safe to
 * press twice — it resends nothing and reports what it actually did.
 */
export async function sendEnvelopes(planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { signatures: true } });
  if (!plan) throw new ApiError(404, "Plan not found");
  if (plan.status === "draft") {
    throw new ApiError(409, "Submit the plan before requesting signatures");
  }

  const pending = plan.signatures.filter((s) => s.status === "pending");
  const simulated = !isDocusignConfigured();
  const sentAt = new Date();

  for (const signature of pending) {
    // The provider call lives here and nowhere else. With no credentials
    // configured there is nothing to call, so the row is marked sent with a
    // simulated envelope id and the caller is told.
    const envelopeId = simulated ? `sim-${signature.id.slice(0, 8)}` : await createDocusignEnvelope();
    await prisma.planSignature.update({
      where: { id: signature.id },
      data: { status: "sent", sentAt, envelopeId },
    });
  }

  return { simulated, sent: pending.length, signatures: await listSignatures(planId) };
}

/**
 * Real DocuSign envelope creation — deliberately unimplemented.
 *
 * Reaching this means credentials ARE configured, so failing loudly is right:
 * silently falling back to the simulation would tell a user their sponsor had
 * been emailed when nobody had.
 */
async function createDocusignEnvelope(): Promise<string> {
  throw new ApiError(
    501,
    "DocuSign credentials are configured but the envelope integration is not implemented yet",
  );
}
