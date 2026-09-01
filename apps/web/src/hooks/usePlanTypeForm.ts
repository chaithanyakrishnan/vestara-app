import { useMemo, useRef } from "react";
import type { FieldValues, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodTypeAny } from "zod";
import { planProfile, type PlanProfile } from "@vestara/shared";

/** The plan type recorded on the draft's identity step, if it has one yet. */
export function usePlanType(plan: any): string | undefined {
  return useMemo(
    () => plan?.stepData?.find((s: any) => s.stepKey === "identity")?.data?.planType,
    [plan],
  );
}

export function usePlanProfile(plan: any): PlanProfile {
  const planType = usePlanType(plan);
  return useMemo(() => planProfile(planType), [planType]);
}

/**
 * A resolver that validates against the schema for THIS plan's type.
 *
 * `useForm` captures its options on first render, and the plan loads
 * asynchronously — so a resolver built in render would be fixed to the 401(k)
 * default that was current when the form mounted. Reading the plan type from a
 * ref inside the resolver means the first validation pass after the plan
 * arrives already uses the right schema, with no form re-creation.
 */
export function usePlanTypeResolver<T extends FieldValues>(
  build: (planType?: string) => ZodTypeAny,
  planType: string | undefined,
): Resolver<T> {
  const ref = useRef(planType);
  ref.current = planType;
  return useMemo<Resolver<T>>(
    () => (values, context, options) => zodResolver(build(ref.current))(values, context, options),
    [build],
  );
}
