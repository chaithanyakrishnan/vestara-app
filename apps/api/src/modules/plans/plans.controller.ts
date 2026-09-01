import type { Request, Response } from "express";
import { ContactGateSchema } from "@vestara/shared";
import * as plansService from "./plans.service";
import * as esignService from "../esign/esign.service";
import { ApiError } from "../../middleware/error.middleware";
import { z } from "zod";

export async function listPlansHandler(req: Request, res: Response) {
  const plans = await plansService.listPlansForUser(req.user!.sub, req.user!.role);
  res.json(plans);
}

export async function createPlanHandler(req: Request, res: Response) {
  const contact = ContactGateSchema.parse(req.body);
  // Sponsor-initiated: the logged-in sponsor is the plan owner, no advisor
  // account linked yet (advisor contact is captured as free text on the
  // gate). Advisor-initiated flow would set advisorUserId = req.user.sub
  // and prompt for the sponsor's account separately — left as a TODO hook.
  const sponsorUserId = req.user!.role === "sponsor" ? req.user!.sub : req.body.sponsorUserId;
  if (!sponsorUserId) throw new ApiError(400, "sponsorUserId is required when an advisor creates a plan");

  const advisorUserId = req.user!.role === "advisor" ? req.user!.sub : null;
  const plan = await plansService.createPlanFromGate(sponsorUserId, advisorUserId, contact);
  res.status(201).json(plan);
}

export async function getPlanHandler(req: Request, res: Response) {
  const plan = await plansService.getPlan(req.params.planId);
  res.json(plan);
}

export async function resetPlanDraftHandler(req: Request, res: Response) {
  const plan = await plansService.resetPlanDraft(req.params.planId);
  res.json(plan);
}

const PlanStatusSchema = z.object({ planStatus: z.enum(["new", "transfer"]) });

export async function setPlanStatusHandler(req: Request, res: Response) {
  const { planStatus } = PlanStatusSchema.parse(req.body);
  const result = await plansService.setPlanStatus(req.params.planId, planStatus);
  res.json(result);
}

export async function deletePlanHandler(req: Request, res: Response) {
  await plansService.deletePlan(req.params.planId);
  res.status(204).end();
}

const StepParamsSchema = z.object({ planId: z.string().uuid(), stepKey: z.string() });

export async function updateStepHandler(req: Request, res: Response) {
  const { planId, stepKey } = StepParamsSchema.parse(req.params);
  const saved = await plansService.updateStep(planId, stepKey, req.body);
  res.json({ stepKey, data: saved });
}

const TrusteesBodySchema = z.object({
  trustees: z.array(z.object({ name: z.string().min(1), type: z.enum(["Individual", "Corporate"]) })),
});

export async function replaceTrusteesHandler(req: Request, res: Response) {
  const { trustees } = TrusteesBodySchema.parse(req.body);
  const saved = await plansService.replaceTrustees(req.params.planId, trustees);
  res.json(saved);
}

// No body: execution happens in the e-sign envelopes, not in a typed name on
// the review screen.
export async function submitPlanHandler(req: Request, res: Response) {
  const plan = await plansService.submitPlan(req.params.planId);
  res.json(plan);
}

export async function sendEnvelopesHandler(req: Request, res: Response) {
  const result = await esignService.sendEnvelopes(req.params.planId);
  res.json(result);
}
