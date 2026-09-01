# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vestara — a 401(k)/403(b) plan-onboarding wizard. pnpm monorepo: React SPA (`apps/web`), Express + Prisma API (`apps/api`), shared Zod schemas (`packages/shared`). SQLite by default (a file at `apps/api/prisma/dev.db`), Postgres-ready.

It is a rebuild of a single-file HTML prototype (`Vestara-v4.html`). Many code comments explain a decision by contrast with that prototype — that context is historical, not a TODO.

## Commands

This is an **npm workspaces** repo (it was converted from pnpm; ignore any `pnpm`/`--filter` invocations still lingering in docs).

```bash
npm install
npm run db:migrate                       # creates dev.db + migrations
npm run db:seed                          # demo users, password demo1234
npm run dev                              # api :4000 + web :5173 concurrently
npm run dev:api / npm run dev:web        # one side only
npm run build                            # shared → api → web (order matters)
npm run db:generate                      # prisma generate after schema edits
npm run prisma:studio --workspace=@vestara/api
npm run verify:extraction --workspace=@vestara/api   # MOCK_EXTRACTION vs. the real schemas
```

`apps/api/.env` is created automatically from `.env.example` by `apps/api/scripts/ensure-env.js`, which runs on `postinstall` and again before every `prisma:*` script — no manual `cp` step. Note that Prisma resolves a relative SQLite `DATABASE_URL` **against the schema's directory**, not the cwd, so the correct value is `file:./dev.db` (→ `apps/api/prisma/dev.db`); `file:./prisma/dev.db` silently creates `apps/api/prisma/prisma/dev.db`.

The web dev server proxies `/api` → `localhost:4000`, so the SPA is always same-origin in dev.

There is **no test runner and no linter configured** in this repo. Verification means `npm run build` (type-check, currently green), `verify:extraction`, and running the app. Do not invent `npm test` / `npm run lint` scripts in documentation or CI without adding the tooling first.

`db:migrate` is hardcoded to `prisma migrate dev --name init`. For any migration after the first, run it directly with a real name:
`npm exec --workspace=@vestara/api -- prisma migrate dev --name <name>`.

**Prisma versions are deliberately split.** `apps/api` pins `prisma`/`@prisma/client` at `^6` and npm nests them under `apps/api/node_modules` — that is the version every `db:*` script actually runs, and v6 is the floor: **Prisma 5's SQLite connector rejects the `Json` scalar**, which `PlanStepData.data` and `AiExtraction.rawOutput` depend on, so downgrading breaks `migrate` at schema validation. The root pins `prisma@^8.0.0-rc.12` separately for `prisma skills sync` (see `prisma.config.ts`); that RC is a different-generation CLI with a different command set, so never run root-level `prisma` against `apps/api/prisma/schema.prisma`.

## Architecture

**`packages/shared` is the contract.** `src/schemas/stepRegistry.ts` defines step order, keys, labels, and the Zod schema per step. The API validates every write against it, the web forms use the same schema as their `react-hook-form` resolver, and `WizardLayout` renders the rail from it. Changing the wizard means changing the registry first — nothing else hardcodes the step list.

The package is consumed as **raw TypeScript source** (`main`/`types` both point at `src/index.ts`), resolved through the workspace symlink. `tsx` and Vite compile it in place; only `pnpm build` emits `dist`.

**Wizard data is generic, not per-step tables.** `PlanStepData` is `{planId, stepKey, data: Json}` with a unique `(planId, stepKey)`. `plans.service.updateStep` is the *single* write path for all six steps: look up the schema by `stepKey`, `parse`, upsert, then advance `currentStep` / `maxStepReached`. Normalized tables exist only where the data is genuinely relational (`PlanTrustee`, `Document`, `AiExtraction`, `FieldProvenance`).

`maxStepReached` only ever increases (`bumpMaxStepReached`), which is what keeps later rail steps unlocked after the user jumps back to edit an earlier one.

**AI extraction shares the same validation path.** `extraction.service.runExtraction` produces a parsed object (real Claude call when `ANTHROPIC_API_KEY` is set, otherwise the deterministic `MOCK_EXTRACTION` sample), then `applyExtractionToPlan` `safeParse`s each section against the *same* step schema. Sections that pass are written to `PlanStepData` and get a `FieldProvenance` row with `source: "ai"`; sections that fail are returned as `skippedSections` rather than written. Provider-specific code is deliberately confined to `extractWithClaude` — swapping providers or adding retries/queueing should touch only that function.

**Validation is per field, not per section.** `schema.safeParse(section)` is one verdict for ~15 fields, so a single unreadable field used to discard everything the parser read — on the real Avantax samples that cost the whole `identity` section (employer name, EIN, address, plan name and number) and read to the user as "the document wasn't read fully". `extractionRecovery.ts` now sits in front of validation:

- `normalizeSection` reformats before validating — prose dates (`"January 1, 2019"` → `01/01/2019`), un-hyphenated TINs, a plan number given as `1`, phone numbers to `(XXX) XXX-XXXX`, blank strings treated as absent. It also canonicalizes `planYearEnd` (`"December 31"` → `"Dec 31"`): the field is free text in the schema but a `<select>` in the form, and a value that matches no option renders **blank**, so a correctly-read election looked unread and then failed validation on save. It also **downgrades `planStatus: "transfer"` to `"new"` when no prior recordkeeper is named**: every sample is an amendment-and-restatement, which a model reads as "not a new plan", and the resulting superRefine failure was the single biggest source of dropped sections.
- `salvageSection` validates field by field, keeps every field that passes, and reports `droppedFields` / `missingFields`. A section only becomes a `skippedSection` when *nothing* in it was readable.

Because a partial section can now reach `PlanStepData`, two things must stay true:

1. `validateReadyToSubmit` re-validates every stored section against its schema — presence alone is not enough, or an incomplete prefill could be submitted.
2. `ExtractionReviewPage` calls `missingFieldLabels` and shows "Still needed: …" per section. Prefilling partially is only honest if the outstanding fields are named.
3. **`Review` (the sign-off screen) must run the same per-field check, not a presence check.** It used to mark a step complete whenever a `PlanStepData` row existed, so a partial prefill read as ready-to-sign and the user only learned otherwise from a raw 422 after signing. It now calls `missingFieldLabels` per step (merging `plan.trustees` for `trustees_funds`, as `validateReadyToSubmit` does), names the outstanding fields with a jump link, and disables Submit. `validateReadyToSubmit` `safeParse`s `trustees_funds` too — a bare `.parse` there escaped as a 400 `ZodError` instead of the 422 the screen knows how to render.

Three older guards still apply:

1. `MOCK_EXTRACTION` must actually validate. `npm run verify:extraction --workspace=@vestara/api` safe-parses every section against the real schemas and is the regression guard — run it after editing the mock or any step schema.
2. `EXTRACTION_PROMPT`'s section keys must match `STEP_KEYS` exactly, including `trustees_funds` (a top-level `trustees` array populates the normalized `PlanTrustee` table, and is separate).
3. `applyExtractionToPlan` bumps `maxStepReached` to the furthest step it filled. Without that the plan sits at 0, `WizardLayout` locks every later step, and successfully extracted data is unreachable.

`identity` keeps **both** effective dates: `originalEffectiveDate` (Election 4(c), "Initial Effective Date of Plan") and `restatedEffectiveDate` (4(d)). Every real sample is an amendment and restatement, and the document calls the *restatement* date "the Effective Date" — storing only the original one discarded the operative date.

`EXTRACTION_PROMPT` also carries a **where-to-look** block, because these documents put nothing on page 1 but the plan title: the Employer/Plan block is `ARTICLE I / DEFINITIONS` → `1. EMPLOYER (1.24)` / `2. PLAN (1.42)` on Relius/Avantax forms and `EMPLOYER INFORMATION / Part A. Adopting Employer` on Ascensus ones. It also points at the **ADMINISTRATIVE CHECKLIST** (`AC1. PLAN LOANS` … `AC12. TRUSTEE(S)`) that follows the signature page — not part of the Adoption Agreement, but the only place loans, rollovers, the plan-expense payer, the Name of Trust and the named trustees are actually recorded. Keep all three vocabularies in the prompt when editing it.

**The gate schema and `PlanContact` intentionally disagree on field names.** `AdvisorContactSchema` has `firm` and `fiduciary`; `SponsorContactSchema` has `org`; the table has one `org` column for both plus `fiduciaryRole`. `createPlanFromGate` therefore maps contacts field by field — never spread a contact object into a Prisma `create`, because excess-property checking doesn't apply to spreads, so TypeScript passes and Prisma throws `Unknown argument` at runtime.

The gate collects a **third, conditional party: the TPA.** `TpaContactSchema` is elect-then-configure (`engaged` + a `superRefine` requiring `firm` only once elected) and is `.optional()` on `ContactGateSchema`, so a caller predating it still creates a plan. It lands in the same `PlanContact` table with `type: "tpa"` — firm in `org`, the individual in `name` — and **`engaged` is deliberately not stored: the presence of the row *is* the election.** That is why `PlanContact.name` and `.email` are nullable: a TPA is identified by its firm, and the person there is often unknown at gate time. Advisor and sponsor still require both, enforced by `ContactGateSchema` on the write path. The Review screen prints the TPA (or "None engaged" — itself an answer the signer confirms) and the dashboard keeps it searchable without giving it a column.

**Confidence rides alongside the values, not inside them.** The model emits a `_confidence` map as a sibling key in each section (`{ employerEin: 0.99, trustName: 0.71 }`). `splitConfidence` strips it *before* `safeParse` — it is not part of any step schema, so leaving it in would fail every section — and stores it on `FieldProvenance.fieldConfidences`, with the mean on `.confidence`. Forms surface it through `AiProvenanceProvider` + `FormField name=`, which renders two chips on the field's **label row** — a flat `AI` marker and a `HIGH`/`MEDIUM`/`LOW` pill (`confidenceTier`, bands 0.9 / 0.7). A field the extraction never reported renders **neither chip**, so the badges mean "this came from your document", not "this form is AI-aware". `lib/confidence.ts` owns both that and the continuous red→amber→green ramp, which the extraction review screen still uses because comparing scores is the point there.

**The extraction review screen is a gate, not a summary.** `/onboarding/:planId/extraction/:documentId` renders every extracted field with its score and offers "Use this data" or "Discard and enter manually". Extraction writes straight into the draft, so without it the only way to audit a parse is to walk all six steps. It reads from the plan (stepData + provenance), so a refresh shows the same thing.

**"Enter Manually" resets the draft.** `POST /plans/:planId/reset-draft` clears `PlanStepData`, `FieldProvenance` and `PlanTrustee` and returns the plan to step 0. The forms hydrate from whatever is saved, so without this a plan that already had a document extracted would drop the user into pre-filled fields right after they chose to start fresh. Contacts and `Document`/`AiExtraction` audit rows deliberately survive.



**The dashboard is a submissions table, and the API computes its row summary.** `DashboardPage` renders a KPI strip (total / new / transfers / signed / pending signature), plan-type count chips that double as a filter, a search box, three filters, sortable headers, and a row carrying plan + EIN + plan number, type, sponsor, advisor, **compliance**, investments, payroll, fee method, signature and actions.

Those columns need fields from three different steps, so `listPlansForUser` maps every plan through **`toPlanSummary`** and returns `{...plan, summary}` with `stepData` and `trustees` **stripped**. Two reasons it is server-side, both load-bearing:

- `administration` holds the employer's bank routing and account numbers. Shipping raw step JSON for every plan would put those in a list response that any authenticated caller can fetch (there is still no ownership check). The summary exposes `planExpensePayer` / `employerPaymentMethod` and never the credentials.
- **Compliance is a re-validation, not a row count.** `toPlanSummary` `safeParse`s each stored step against `schemaForStep`, merging `plan.trustees` into `trustees_funds` exactly as `validateReadyToSubmit` does. Counting `PlanStepData` rows would score a partial AI prefill as complete — the same trap `Review` fell into.

There is deliberately **no e-signature-vendor column**: signing here is the typed signature captured on Review, so the Signature column reports `signatureName` / `submittedAt`.


**Signing is e-signature, not a typed name.** The Review screen used to collect a typed legal name and `POST /plans/:planId/submit` required it. It no longer does — `submitPlan(planId)` takes no body. Submitting means **elections final, signatures requested**: it validates, sets `status: "submitted"`, and calls `createSignatureRequests`, which builds one `PlanSignature` row per party from `PlanContact` (sponsor, advisor, TPA — in that signing order). A contact with **no email is skipped**, not written as a row that can never progress, and the Review screen says so before you submit.

`Plan.signatureName` is kept but no longer written. Plans submitted under the old flow have it and no `PlanSignature` rows at all, so `toPlanSummary` treats that as executed — otherwise they would read as "awaiting signature" forever.

**`esign.service.ts` is the only file that knows about DocuSign**, mirroring how `extractWithClaude` confines Claude. Everything else deals in rows with a `status` (`pending` → `sent` → `signed`). `POST /plans/:planId/esign/send` advances every *pending* row, so the button is safe to press twice (it reports `sent: 0`), and it 409s on a draft. With no `DOCUSIGN_ACCOUNT_ID` / `DOCUSIGN_INTEGRATION_KEY` configured the send is **simulated** — rows get a `sim-` envelope id and the response carries `simulated: true`, which the success screen states plainly rather than implying an email went out. If credentials *are* configured, `createDocusignEnvelope` throws a 501 instead of silently falling back: telling someone their sponsor was emailed when nobody was is the one failure mode worth being loud about.

Signing order (sponsor first) is not alphabetical and no column encodes it, so `sortSigners` is applied both in `listSignatures` and in `getPlan`, which reads signatures through its own Prisma include.

**Deleting a plan is draft-only, and enforced server-side.** `DELETE /plans/:planId` (dashboard row action) refuses anything not `status: "draft"` with a 409 — a submitted plan's signature name and timestamp are the record of a legal election. The dashboard only renders the button on drafts, but that is convenience; `plans.service.deletePlan` is the check. Every child table declares `onDelete: Cascade`, so one `plan.delete` takes contacts, step data, trustees, provenance, documents and their `AiExtraction` rows with it — the uploaded **files** are not in the database, so `deletePlan` unlinks them from `env.uploadDir` first, best-effort (a missing file must not abort the delete and leave the row orphaned). Contrast `reset-draft` above, which keeps the plan and only clears the answers.

`FieldProvenance` is **section-level** (`fieldPath` = a step key like `"identity"`), not per-input. Forms render one "pre-filled from your document" banner per section on that basis.

**Error contract.** API: `ZodError` → 400 `{error, issues: [{path, message}]}`; `ApiError` → its own status; anything else → 500 (`error.middleware.ts`). Web: `apiClient` throws `ApiClientError` carrying `issues`, and step forms map those back onto fields via `setError` (see the `isApiValidationError` branch in `StepIdentity`). A 401 clears the Zustand auth session.

**Web state split:** `zustand` (`authStore`) for the JWT/session only; `@tanstack/react-query` for all server state, keyed `["plan", planId]`. Each wizard step is its own route (`/onboarding/:planId/step/:stepKey`), so steps are linkable and a refresh resumes correctly; forms hydrate from `plan.stepData` in a `useEffect` + `reset`.

**Business rules that outlive a shape check live beside the write path, not in the schema.** `VestingStepSchema` stops at "must reach 100% by the final year" and defers the IRC §411(a)(2)(B) minimum-vesting check to `plans/irsVestingFloor.ts`, which `updateStep` calls for the vesting step. That check accepts a custom ladder satisfying *either* the six-year graded floor or the three-year cliff, and rejects any schedule that decreases.

## Building wizard step forms

All six steps have real forms. `StepIdentity.tsx` is the reference: `useForm` with `zodResolver(<Step>Schema)` → hydrate from `plan.stepData` in a `useEffect` + `reset` → `useUpdateStep(planId, stepKey)` → navigate to the next step. `StepPlaceholder.tsx` is now unreferenced.

**Shared controls** (`apps/web/src/components/`) — prefer these over bare inputs; they carry the prototype's look and the accessibility/masking behavior:

| Component | Use for |
|---|---|
| `OptionCard` / `OptionGrid` | Any choice worth explaining — replaces multi-option `<select>`s and checkboxes. `checkable` renders a tick box for multi-select. |
| `ToggleRow` + `RevealSection` | Elect-then-configure blocks (safe harbor, loans, auto-enrollment) |
| `PhoneInput` / `DateInput` / `EinInput` | Masked fields — `(XXX) XXX-XXXX`, `MM/DD/YYYY` + calendar, `XX-XXXXXXX` + company lookup |
| `AffixInput` | `$` prefix / `%` suffix |
| `AiSectionBanner` | The per-section "pre-filled from your document" notice |
| `AiProvenanceProvider` | Wrap the form; `FormField name="schemaField"` then renders its own colour-coded confidence badge |

Masked inputs stay **uncontrolled**: they rewrite `event.target.value` before delegating to react-hook-form, so RHF records the formatted string with no re-render per keystroke. The caret anchoring and backspace-onto-separator handling live once in `lib/mask.ts` + `hooks/useMaskedField.ts` — build new masks on those rather than reimplementing. Because they only reformat on interaction, a form hydrating from server/AI data must run values through the matching formatter in its `reset` call, as `StepIdentity` does.

**Two traps these forms exist to work around:**

- **`z.coerce.number()` turns an empty input into `0`, not `undefined`** — which silently defeats every `=== undefined` superRefine (a blank "minimum loan amount" would arrive as `0` and pass the "required when loans are permitted" check). Every coerced numeric field must register with `numericField` from `lib/forms.ts`.
- **Toggling a conditional block off does not strip its fields.** Clear dependents explicitly via the `makeFieldSetter` helper, or stale values persist into `stepData`.
- **A `<select>` submits `""`, and `z.enum([...]).optional()` rejects `""`.** Any select bound to an optional enum must register with `optionalEnumField` from `lib/forms.ts`. Administration's employer-payment selects didn't, so an untouched form failed on `employerPaymentMethod` — inside a *collapsed* `RevealSection`, where the error had nowhere to render — and the step was un-submittable until Plan Expenses was toggled, because the toggle's field-clearing setters replaced `""` with `undefined`.

Because these forms hide fields behind `RevealSection`, every step form renders `<FormErrorSummary errors={errors} />` above its actions. A validation error on a hidden field otherwise produces a submit button that silently does nothing.

`vesting.customSchedule` errors attach to the **array root**, so render `errors.customSchedule?.message` above the table rather than per row. Trustee `type` is the package's only capitalized enum (`"Individual"` / `"Corporate"`).

## Known gaps to be aware of before touching related code

- **No ownership check on plan routes.** `requireAuth` proves *a* valid JWT; nothing verifies the caller is the plan's sponsor or advisor, so any authenticated user can read or write any plan by id. `requireRole` exists but is unused. This now matters more than it did: `administration` stores bank routing and account numbers in the plan JSON. Fix before anything resembling a real deployment.
- **The parsing progress steps in `UploadPage` are a timed animation, not real progress.** The upload bar above them *is* real (XHR byte events, via `uploadWithProgress`), and the per-section summary afterwards is the server's actual result — but `POST /documents/:id/extract` is one blocking call with no progress channel. Making the middle honest needs an SSE or polling endpoint.
- Advisor-initiated plan creation is a stub — `createPlanHandler` expects `sponsorUserId` in the body when an advisor calls it, with no lookup UI behind it.
- **`vestara-app/vestara-app/` is a stale nested copy of the whole project** with its own `.git`. Untracked, and a live hazard for search-and-replace work — every path in this file refers to the top-level `apps/` and `packages/`.
