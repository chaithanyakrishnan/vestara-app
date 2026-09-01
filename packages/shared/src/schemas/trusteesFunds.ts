import { z } from "zod";

export const TrusteeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Trustee name is required"),
  type: z.enum(["Individual", "Corporate"]).default("Individual"),
});
export type Trustee = z.infer<typeof TrusteeSchema>;

export const TrusteesFundsStepSchema = z.object({
  trustees: z.array(TrusteeSchema).min(1, "At least one trustee is required"),
  trusteeType: z.enum(["disc", "dir"]),
  selectedFundTickers: z
    .array(z.string())
    .min(3, "ERISA §404(c) protection requires at least 3 core fund options"),
  qdia: z.enum(["target", "balanced", "managed"]),
});
export type TrusteesFundsStepInput = z.infer<typeof TrusteesFundsStepSchema>;
