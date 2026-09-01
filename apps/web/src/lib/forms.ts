import type { FieldValues, Resolver, UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodTypeAny } from "zod";

/**
 * Shared react-hook-form registration options and helpers.
 */

/**
 * Register options for any field backed by `z.coerce.number()`.
 *
 * An empty text input yields `""`, and `z.coerce.number()` turns `""` into `0`
 * — NOT `undefined`. That silently defeats every `=== undefined` check in the
 * step schemas: a blank "minimum loan amount" arrives as `0`, sails past the
 * "required when loans are permitted" superRefine, and also passes `.min(0)`.
 * Mapping empty back to `undefined` before validation restores the intent.
 *
 * Usage: `register("loanMinAmount", numericField)`
 */
export const numericField = {
  setValueAs: (v: unknown) => (v === "" || v === null || v === undefined ? undefined : v),
};

/**
 * Register options for any <select> bound to an OPTIONAL `z.enum()` field.
 *
 * A select hands react-hook-form the empty string when its placeholder option
 * ("Select…") is the chosen one, or when a hydrated value matches no option.
 * `""` is not `undefined`, so `z.enum([...]).optional()` rejects it with
 * "Invalid enum value … received ''" — and when the select lives inside a
 * collapsed RevealSection that error has nowhere to render, so the form simply
 * refuses to submit with no visible reason. (This is exactly what made the
 * Administration step un-submittable until Plan Expenses was toggled: toggling
 * ran the field-clearing setters, which replaced "" with undefined.)
 *
 * Usage: `register("employerPaymentMethod", optionalEnumField)`
 */
export const optionalEnumField = {
  setValueAs: (v: unknown) => (v === "" ? undefined : v),
};

/**
 * Wraps RHF's `setValue` for TOP-LEVEL fields of a step form.
 *
 * `setValue` is typed over dotted `Path<T>` strings and `PathValue<T, P>`, which
 * a plain `<K extends keyof T>` helper can't satisfy — TS can't prove the
 * generic key maps to the generic value through those conditional types. Since
 * every caller here uses a flat field name, the cast is contained to this one
 * function instead of being sprinkled through five step forms.
 *
 * Passing `undefined` clears a field, which is what a toggled-off conditional
 * block needs: the schemas keep (rather than strip) dependent fields, so stale
 * values would otherwise persist into stepData.
 */
export function makeFieldSetter<T extends FieldValues>(setValue: UseFormSetValue<T>) {
  return <K extends keyof T & string>(name: K, value: T[K] | undefined) =>
    setValue(name as never, value as never, { shouldValidate: true, shouldDirty: true });
}

/**
 * A zodResolver whose schema is chosen at validation time from the plan type.
 *
 * `useForm({ resolver })` captures its options on the first render, so swapping
 * the schema when the user changes the plan-type dropdown cannot be done by
 * rebuilding the resolver in render — the form would keep validating against
 * whatever type it was created with. Resolving the schema inside the call
 * instead means every validation pass uses the type currently in effect.
 *
 * `getPlanType` receives the form's current values, so the identity step can
 * read the dropdown the user just changed, while later steps read it from the
 * loaded plan.
 */
export function planTypeResolver<T extends FieldValues>(
  build: (planType?: string) => ZodTypeAny,
  getPlanType: (values: T) => string | undefined,
): Resolver<T> {
  return (values, context, options) =>
    zodResolver(build(getPlanType(values as T)))(values, context, options);
}
