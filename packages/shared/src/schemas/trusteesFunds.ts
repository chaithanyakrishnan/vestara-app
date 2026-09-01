import { z } from "zod";
import { planProfile } from "./planProfile";

export const TrusteeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Trustee name is required"),
  type: z.enum(["Individual", "Corporate"]).default("Individual"),
});
export type Trustee = z.infer<typeof TrusteeSchema>;

const TrusteesFundsBase = z.object({
  /**
   * Required only where the plan actually has a trust. A non-governmental
   * 457(b) must NOT have one — its assets stay the employer's property and
   * subject to its general creditors, Section 457(b)(6) — and a 403(b) holds
   * custodial accounts or annuity contracts under a custodian or issuer.
   */
  trustees: z.array(TrusteeSchema).default([]),
  trusteeType: z.enum(["disc", "dir"]).optional(),

  /** 403(b): the custodian or insurance company that holds the accounts. */
  custodianName: z.string().optional().or(z.literal("")),
  /** 403(b): investment providers/vendors approved under the plan. */
  investmentProviders: z.array(z.string()).optional(),

  selectedFundTickers: z.array(z.string()).default([]),
  qdia: z.enum(["target", "balanced", "managed"]).optional(),

  /**
   * Section 404(c) is OPTIONAL RELIEF, not a requirement — the old copy said it
   * "requires at least 3 core fund options", which is wrong twice over. The
   * regulation asks for a broad range: at least three diversified alternatives
   * with materially different risk and return characteristics
   * (29 CFR 2550.404c-1(b)(3)). Three sector funds would pass a count and fail
   * the test, so the minimum applies only where the relief is actually claimed.
   */
  claims404c: z.boolean().optional(),

  // ---- fiduciary appointments (ERISA Section 402(a), Section 3(16)) ----
  planAdministratorName: z.string().optional().or(z.literal("")),
  planAdministratorIsEmployer: z.boolean().optional(),
  namedFiduciary: z.string().optional().or(z.literal("")),
  agentForServiceOfProcess: z.string().optional().or(z.literal("")),

  // ---- ERISA Section 412 fidelity bond ----
  fidelityBondCarrier: z.string().optional().or(z.literal("")),
  fidelityBondAmount: z.coerce.number().min(0).optional(),
});

export type TrusteesFundsStepInput = z.infer<typeof TrusteesFundsBase>;

export function buildTrusteesFundsSchema(planType?: string) {
  const p = planProfile(planType);

  return TrusteesFundsBase.superRefine((val, ctx) => {
    const require = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    // ---- who holds the assets ----
    if (p.requiresTrustee) {
      if (val.trustees.length === 0) {
        require("trustees", "At least one trustee is required");
      }
      if (!val.trusteeType) {
        require("trusteeType", "Select whether the trustee is directed or discretionary");
      }
    } else if (p.fundingVehicle === "custodial_annuity") {
      if (!val.custodianName) {
        require("custodianName", "Name the custodian or annuity issuer holding plan assets");
      }
      if (val.trustees.length > 0) {
        require("trustees", "A 403(b) holds custodial accounts or annuity contracts — it has no trustee");
      }
    } else if (p.fundingVehicle === "unfunded") {
      if (val.trustees.length > 0) {
        require(
          "trustees",
          "A non-governmental 457(b) must remain unfunded — appointing a trustee for participants' benefit would forfeit its treatment",
        );
      }
    }

    // ---- investments ----
    if (val.selectedFundTickers.length === 0) {
      require("selectedFundTickers", "Select at least one investment option");
    }
    if (val.claims404c) {
      if (!p.erisa404cAvailable) {
        require("claims404c", `ERISA Section 404(c) relief is not available to a ${p.label} plan`);
      } else if (val.selectedFundTickers.length < 3) {
        require(
          "selectedFundTickers",
          "Claiming Section 404(c) needs a broad range: at least three diversified options with materially different risk and return characteristics",
        );
      }
    }
    if (!val.qdia && p.electiveDeferrals) {
      require("qdia", "Select a qualified default investment alternative");
    }

    // ---- fiduciary appointments, where ERISA applies ----
    if (p.files5500) {
      if (!val.planAdministratorIsEmployer && !val.planAdministratorName) {
        require("planAdministratorName", "Name the plan administrator (ERISA Section 3(16))");
      }
      if (!val.namedFiduciary) {
        require("namedFiduciary", "Name at least one named fiduciary (ERISA Section 402(a))");
      }
      if (val.fidelityBondAmount === undefined) {
        require("fidelityBondAmount", "State the ERISA Section 412 fidelity bond amount");
      }
    }
  });
}

export const TrusteesFundsStepSchema = buildTrusteesFundsSchema("401k");
