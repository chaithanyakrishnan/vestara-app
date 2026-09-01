import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../lib/asyncHandler";
import {
  listPlansHandler,
  createPlanHandler,
  getPlanHandler,
  resetPlanDraftHandler,
  setPlanStatusHandler,
  deletePlanHandler,
  updateStepHandler,
  replaceTrusteesHandler,
  submitPlanHandler,
  sendEnvelopesHandler,
} from "./plans.controller";

export const plansRouter = Router();
plansRouter.use(requireAuth);

plansRouter.get("/", asyncHandler(listPlansHandler));
plansRouter.post("/", asyncHandler(createPlanHandler));
plansRouter.get("/:planId", asyncHandler(getPlanHandler));
// Clears every wizard answer — backs the "Enter Manually" intake choice.
plansRouter.post("/:planId/reset-draft", asyncHandler(resetPlanDraftHandler));
// Records the new-plan / transfer election made before the wizard starts.
plansRouter.put("/:planId/plan-status", asyncHandler(setPlanStatusHandler));
// Draft-only — plans.service.deletePlan rejects anything already submitted.
plansRouter.delete("/:planId", asyncHandler(deletePlanHandler));
plansRouter.put("/:planId/steps/:stepKey", asyncHandler(updateStepHandler));
plansRouter.put("/:planId/trustees", asyncHandler(replaceTrusteesHandler));
plansRouter.post("/:planId/submit", asyncHandler(submitPlanHandler));
// Sends the e-signature envelopes for an already-submitted plan. Simulated
// unless DocuSign credentials are configured — see esign.service.ts.
plansRouter.post("/:planId/esign/send", asyncHandler(sendEnvelopesHandler));
