# Vestara — Plan Onboarding (React / Node / SQLite)

A working monorepo rebuild of the Vestara-v4.html prototype: React + TypeScript
frontend, Express + Prisma API, SQLite by default (Postgres-ready), shared Zod validation, and an
AI document-extraction module with a real audit trail.

## What's fully built vs. scaffolded

**End-to-end working:**
- Auth (register/login/JWT), seeded demo sponsor + advisor users
- Dashboard, contact gate, intake method screen
- PDF upload → AI extraction (mock fallback with no API key, or real Claude
  call if `ANTHROPIC_API_KEY` is set) → validated write into the plan draft
  → field-provenance audit trail
- Wizard steps **Company & Plan Identity** and **Contributions & Safe
  Harbor** — full form, validation (client + server, same Zod schema),
  resumable draft, AI-provenance banner
- Review & Sign screen (reads real draft data), server-side submit
  validation (`validateReadyToSubmit`), success screen

**Scaffolded, not yet built (by design, see `StepPlaceholder.tsx`):**
- Eligibility, Vesting, Administration, Trustees & Funds — the Zod schema,
  API route, and DB persistence already work for all of these; only the
  React form UI is stubbed. Build them following `StepIdentity.tsx`.
- Custom vesting schedule editor, fund-lineup picker UI, EIN autocomplete,
  the date picker widget from the original HTML — none ported yet.

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm i -g pnpm`)

No database server to install — this uses SQLite by default (a plain file
at `apps/api/prisma/dev.db`). See "Using Postgres instead" below if you
want closer production parity later.

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure the API (defaults work as-is — SQLite, no server needed)
cp apps/api/.env.example apps/api/.env

# 3. Run migrations + seed demo users (creates apps/api/prisma/dev.db)
pnpm db:migrate
pnpm db:seed

# 4. Start both apps
pnpm dev
```

- API: http://localhost:4000 (health check: `GET /health`)
- Web: http://localhost:5173

Demo logins (seeded): `murthy@altimetrik1.com` / `chai@lpl.com`, both
password `demo1234` (sponsor and advisor respectively).

## Using Postgres instead

If you later want to run this against real Postgres (Docker, a native
install, or a hosted instance):

1. In `apps/api/prisma/schema.prisma`, change `provider = "sqlite"` to
   `provider = "postgresql"` under `datasource db`.
2. Set `DATABASE_URL` in `apps/api/.env` to your Postgres connection string.
3. Delete `apps/api/prisma/migrations` (SQLite and Postgres migrations
   aren't interchangeable) and re-run `pnpm db:migrate`.

Every model already uses portable types (`String`, `Int`, `DateTime`,
`Json`) — the only thing SQLite cost us is native database-level enums,
which were replaced with plain strings validated by the Zod schemas in
`@vestara/shared` (identical enforcement, just at the application layer
instead of the DB layer).

## AI extraction

Without `ANTHROPIC_API_KEY` set in `apps/api/.env`, uploading a PDF runs a
deterministic mock extraction (the same 4 Bears Casino & Lodge sample data
as the original prototype) so the full upload → parse → prefill flow works
with zero external dependencies. Set the key to call the real Claude API
against the uploaded PDF (`apps/api/src/modules/extraction/extraction.service.ts`).

## Architecture notes

- `packages/shared` — Zod schemas are the single source of truth for what a
  valid wizard step looks like. The API validates writes against them; the
  web app's `react-hook-form` resolvers use the exact same schema.
- `PlanStepData` (generic `{planId, stepKey, data jsonb}`) replaces one
  table per wizard step — normalized tables are used only where the data
  is genuinely relational (trustees, documents, AI provenance).
- `FieldProvenance` records whether each section's data came from AI
  extraction or manual entry, with a link to the extraction run that
  produced it — the audit trail the static HTML prototype had no way to
  provide.
- `maxStepReached` on `Plan` drives which rail steps are unlocked; it only
  advances, so jumping back to edit step 2 doesn't relock steps 3-6 (this
  was a bug in the original prototype).

## Known gaps / next steps

- No refresh-token rotation — access token is a single 2h JWT, fine for dev.
- No file storage abstraction beyond local disk (`UPLOAD_DIR`) — swap for
  an S3/MinIO-backed `StorageProvider` before this goes further than a
  laptop.
- No tests yet (Vitest is the intended runner per the architecture doc).
- Bank routing/account numbers were deliberately dropped from
  `AdministrationStepSchema` pending an encryption-at-rest decision — the
  original HTML collected them in plaintext inputs, which isn't something
  to carry forward as-is.
