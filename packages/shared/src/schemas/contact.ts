import { z } from "zod";

const phoneRegex = /^\(\d{3}\) \d{3}-\d{4}$/;

export const AdvisorContactSchema = z.object({
  name: z.string().min(1, "Advisor name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().regex(phoneRegex, "Format: (XXX) XXX-XXXX").optional().or(z.literal("")),
  firm: z.string().min(1, "Firm / RIA name is required"),
  title: z.string().optional().or(z.literal("")),
  fiduciary: z.enum(["3_21", "3_38", "non_fid", "unsure"]).default("unsure"),
});

export const SponsorContactSchema = z.object({
  name: z.string().min(1, "Sponsor contact name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().regex(phoneRegex, "Format: (XXX) XXX-XXXX").optional().or(z.literal("")),
  org: z.string().min(1, "Organization name is required"),
  title: z.string().optional().or(z.literal("")),
});

/**
 * Third Party Administrator — the firm that drafts the plan document, files
 * Form 5500 and runs discrimination testing.
 *
 * Elect-then-configure, like the wizard's safe-harbour and loan blocks: nothing
 * below `engaged` is required until the box is ticked, and then only the firm
 * name is — the individual contact often isn't known at gate time. Storing a
 * TPA with no firm name would be a row that identifies nobody, which is what
 * the superRefine prevents.
 */
export const TpaContactSchema = z
  .object({
    engaged: z.boolean().default(false),
    firm: z.string().optional().or(z.literal("")),
    name: z.string().optional().or(z.literal("")),
    email: z.string().email("Enter a valid email").optional().or(z.literal("")),
    phone: z.string().regex(phoneRegex, "Format: (XXX) XXX-XXXX").optional().or(z.literal("")),
  })
  .superRefine((val, ctx) => {
    if (val.engaged && !val.firm) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firm"],
        message: "TPA firm name is required",
      });
    }
  });

export const ContactGateSchema = z.object({
  advisor: AdvisorContactSchema,
  sponsor: SponsorContactSchema,
  // Optional so a caller that predates the TPA block still creates a plan.
  tpa: TpaContactSchema.optional(),
});
export type ContactGateInput = z.infer<typeof ContactGateSchema>;
