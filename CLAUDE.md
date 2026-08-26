# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vestara — a 401(k)/403(b) plan-onboarding wizard. pnpm monorepo: React SPA (`apps/web`), Express + Prisma API (`apps/api`), shared Zod schemas (`packages/shared`). SQLite by default (a file at `apps/api/prisma/dev.db`), Postgres-ready.

It is a rebuild of a single-file HTML prototype (`Vestara-v4.html`). Many code comments explain a decision by contrast with that prototype — that context is historical, not a TODO.

## Commands

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # defaults work as-is
pnpm db:migrate                          # creates dev.db + migrations
pnpm db:seed                             # demo users, password demo1234
pnpm dev                                 # api :4000 + web :5173 concurrently
pnpm dev:api / pnpm dev:web              # one side only
pnpm build                               # shared → api → web (order matters)
pnpm db:generate                         # prisma generate after schema edits
pnpm --filter @vestara/api prisma:studio
```

The web dev server proxies `/api` → `localhost:4000`, so the SPA is always same-origin in dev.

There is **no test runner and no linter configured** in this repo. Verification means `pnpm build` (type-check) plus running the app. Do not invent `pnpm test` / `pnpm lint` scripts in documentation or CI without adding the tooling first.

`db:migrate` is hardcoded to `prisma migrate dev --name init`. For any migration after the first, run it directly with a real name:
`pnpm --filter @vestara/api exec prisma migrate dev --name <name>`.

## Architecture

**`packages/shared` is the contract.** `src/schemas/stepRegistry.ts` defines step order, keys, labels, and the Zod schema per step. The API validates every write against it, the web forms use the same schema as their `react-hook-form` resolver, and `WizardLayout` renders the rail from it. Changing the wizard means changing the registry first — nothing else hardcodes the step list.

The package is consumed as **raw TypeScript source** (`main`/`types` both point at `src/index.ts`), resolved through the workspace symlink. `tsx` and Vite compile it in place; only `pnpm build` emits `dist`.

**Wizard data is generic, not per-step tables.** `PlanStepData` is `{planId, stepKey, data: Json}` with a unique `(planId, stepKey)`. `plans.service.updateStep` is the *single* write path for all six steps: look up the schema by `stepKey`, `parse`, upsert, then advance `currentStep` / `maxStepReached`. Normalized tables exist only where the data is genuinely relational (`PlanTrustee`, `Document`, `AiExtraction`, `FieldProvenance`).

`maxStepReached` only ever increases (`bumpMaxStepReached`), which is what keeps later rail steps unlocked after the user jumps back to edit an earlier one.

**AI extraction shares the same validation path.** `extraction.service.runExtraction` produces a parsed object (real Claude call when `ANTHROPIC_API_KEY` is set, otherwise the deterministic `MOCK_EXTRACTION` sample), then `applyExtractionToPlan` `safeParse`s each section against the *same* step schema. Sections that pass are written to `PlanStepData` and get a `FieldProvenance` row with `source: "ai"`; sections that fail are returned as `skippedSections` rather than written. Provider-specific code is deliberately confined to `extractWithClaude` — swapping providers or adding retries/queueing should touch only that function.

`FieldProvenance` is **section-level** (`fieldPath` = a step key like `"identity"`), not per-input. Forms render one "pre-filled from your document" banner per section on that basis.

**Error contract.** API: `ZodError` → 400 `{error, issues: [{path, message}]}`; `ApiError` → its own status; anything else → 500 (`error.middleware.ts`). Web: `apiClient` throws `ApiClientError` carrying `issues`, and step forms map those back onto fields via `setError` (see the `isApiValidationError` branch in `StepIdentity`). A 401 clears the Zustand auth session.

**Web state split:** `zustand` (`authStore`) for the JWT/session only; `@tanstack/react-query` for all server state, keyed `["plan", planId]`. Each wizard step is its own route (`/onboarding/:planId/step/:stepKey`), so steps are linkable and a refresh resumes correctly; forms hydrate from `plan.stepData` in a `useEffect` + `reset`.

## Adding a wizard step form

`Eligibility`, `Vesting`, `Administration`, and `Trustees & Funds` are wired end-to-end (schema, API route, persistence) but their UI is `StepPlaceholder`. To build one, copy `StepIdentity.tsx` — the pattern is: `useForm` with `zodResolver(<Step>Schema)` → hydrate from `plan.stepData` → `useUpdateStep(planId, stepKey)` → navigate to the next step. Swap the placeholder for the real component in `routes/router.tsx`. No API or schema work is needed.

## Known gaps to be aware of before touching related code

- **No ownership check on plan routes.** `requireAuth` proves *a* valid JWT; nothing verifies the caller is the plan's sponsor or advisor, so any authenticated user can read or write any plan by id. `requireRole` exists but is unused. Fix this before anything resembling a real deployment.
- **`plans.service.getPlan` does not `include: { provenance: true }`**, so `plan.provenance` is always undefined on the client and the AI-provenance banners never render. Adding the include is the fix.
- Advisor-initiated plan creation is a stub — `createPlanHandler` expects `sponsorUserId` in the body when an advisor calls it, with no lookup UI behind it.
