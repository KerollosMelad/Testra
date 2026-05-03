---
name: testra-pr-review
description: >-
  Reviews pull requests against the Testra codebase (Next.js 15 App Router, Supabase,
  OpenAI/Azure DevOps). Use when reviewing PRs for this repo, onboarding reviewers,
  or when the user loads this skill explicitly for AI-assisted PR review.
disable-model-invocation: true
---

# Testra — PR Review Skill

## What this repo is

Testra is a Next.js dashboard for AI-assisted test-case generation and Azure DevOps work-item sync, backed by **Supabase (PostgreSQL)**. Server routes orchestrate embeddings, duplication checks, and streaming OpenAI output.

---

## Architecture map (minimal)

| Area | Location | Notes |
|------|-----------|-------|
| App routes (RSC/pages) | `app/` | Route groups `(dashboard)/…`, `globals.css`, API under `app/api/` |
| API handlers | `app/api/**/route.ts` | Next.js Route Handlers; use `NextRequest` / `NextResponse` |
| Shared UI | `components/ui/` | shadcn/Radix primitives (from `components.json`) |
| Feature UI | `components/dashboard/`, `components/projects/`, `components/test-cases/`, `components/layout/` | Prefer composition over new one-off primitives |
| Domain & clients | `lib/` | `supabase.ts`, `openai.ts`, `azure-devops.ts`, `ai-test-generator.ts`, `types.ts`, `database.types.ts` |
| Scripts | `scripts/` | Maintenance (e.g. `embed-work-items.ts` via `pnpm embed`) |
| DB migrations | `supabase/migrations/*.sql` | Source of truth for schema |

**Path alias:** `@/*` maps to repo root (`tsconfig.json`).

---

## Stack & toolchain

- **Next.js** `^15`, **React** `19`, **TypeScript** `strict`
- **UI:** Tailwind, shadcn (`components.json`), `lucide-react`, Sonner/toast
- **Data:** `@supabase/supabase-js`; server uses **`supabaseAdmin`** (service role) from `@/lib/supabase`
- **AI:** OpenAI SDK; streaming SSE-style chunks in `/api/ai/generate-tests/stream`
- **Forms/validation:** `react-hook-form`, `zod`, `@hookform/resolvers` where applicable
- **Lint:** `pnpm lint` / `npm run lint` → `next lint` (no custom `eslint.config` in repo root)

Verification for reviewers: **`pnpm build`** / **`pnpm lint`** after substantive changes.

---

## Code conventions to enforce

1. **Imports:** Prefer `@/` aliases (`@/components/...`, `@/lib/...`) over deep relative chains.
2. **Styling:** Tailwind + `cn()` from `@/lib/utils` for conditional classes on custom/feature components.
3. **Components:** Extend `components/ui/*` primitives; avoid duplicating button/card/dialog patterns. Watch for **parallel copies** of the same hook (e.g. `hooks/use-mobile.tsx` vs `components/ui/use-mobile.tsx`) — changes should stay consistent.
4. **Types:** DB typing lives in `lib/database.types.ts` (and `src/types/supabase.ts` exists). PRs that change schema should update generated types and stay compatible with `supabaseAdmin` usage.
5. **API routes:** Validate inputs early; return `NextResponse.json` with appropriate `status`; avoid leaking stack traces or secrets in JSON error bodies.
6. **Size & SOLID:** Very large page components (e.g. long dashboard flows) are a maintainability risk — suggest extracting hooks, subcomponents, and pure helpers into `components/` or `lib/` without drive-by refactors outside the PR scope.

---

## Systematic review (orthogonal passes)

Treat each concern below as **independent**. A severe finding on one pass does **not** excuse skipping others for the same diff.

| Pass | Ask |
|------|-----|
| **Trust boundaries** | Who may call this path, and does every downstream read/write match that caller’s entitlement and data sensitivity (including server-only keys and privileged clients)? |
| **Structural I/O shape** | For each branching or iterative structure, mentally trace how many outbound calls execute along typical and stressful paths versus the dataset size feeding that structure. Flag mismatches proportional to severity. |
| **Correctness & contracts** | Types, statuses, payloads, migrations, backward compatibility with existing callers. |
| **Resilience** | Errors, timeouts, partial failure, quotas, UX feedback for user-visible flows. |

When writing feedback, cite **specific lines or symbols** so the human can reconcile comments with intent.

---

## Security & privacy (high priority)

1. **Elevated privileges:** Server-only database clients bypass row-level protections that apply to weaker credentials. Tie their use to a clear notion of caller identity or justify why every row touched is acceptable for that endpoint’s exposure model.
2. **Secrets:** Never log or return `token`, `openaiApiKey`, org/project credentials, or raw service keys to the client or to stderr in production-oriented code.
3. **OpenAI keys:** Stored per project (`openai_api_key` in DB). Ensure keys are only used server-side; validate with existing helpers (`isProjectOpenAIConfigured`, `createOpenAIClient`).
4. **User-supplied HTML/text:** Prefer existing sanitization or plain text pipelines (see `lib/html-to-text.ts` where relevant) before emitting into rich UI or prompts.
5. **Streaming:** Long-running streams implement timeouts — preserve or improve timeout/error boundary behavior when touching streaming endpoints.

---

## Database & migrations

- New tables/columns/indexes/RPC belong in **`supabase/migrations/`** with a clear timestamp prefix; reviewers should reject ad-hoc schema changes only applied in dashboards.
- Regenerate or manually align **`lib/database.types.ts`** when schema changes affect TypeScript surfaces.

---

## Azure DevOps integration

Changes under `lib/azure-devops.ts` and `app/api/azure/**` should preserve:

- PAT/token handling security (never send tokens to unrelated domains or log full values).
- Consistent mapping between Azure work items and stored `work_item*` / relation tables.

---

## AI generation & embeddings

- Streaming and batch generation share context builders — keep **`TestGenerationContext`** and related types in `lib/types.ts` coherent.
- Embedding scripts and `/api/ai/test-cases/embed` flows should remain idempotent-safe where duplicates matter; watch for quota and batch size assumptions.

---

## PR review checklist (copy for agents)

Copy and tick while reviewing:

- [ ] **Correctness:** Edge cases handled; no obvious regressions for happy path.
- [ ] **Trust boundaries:** Secret handling and alignment of privileged access with who may invoke the route.
- [ ] **Conventions:** `@/` imports, `cn()`, shadcn patterns, TypeScript strictness respected.
- [ ] **API:** HTTP status semantics, JSON shape stability for existing clients.
- [ ] **DB:** Migration present if schema changed; types updated.
- [ ] **UX:** Loading/error/toast flows for user-visible operations.
- [ ] **I/O shaping:** Fan-out from control-flow structures versus outbound latency and load (see orthogonal passes table).
- [ ] **Streaming / quotas:** Streams and external APIs keep safe bounds where the diff touches them.
- [ ] **Tests/build:** Lint/build considerations called out if CI is not run here.

---

## How to phrase feedback

Use severity labels consistent with Cursor-style review:

| Label | Meaning |
|-------|---------|
| **Blocking** | Must fix before merge (security bug, broken API contract, migration error). |
| **Should fix** | Strongly recommended (maintainability, missing validation, inconsistent patterns). |
| **Nit / suggestion** | Optional polish (naming, small deduplication, comments).

Keep comments **specific**: cite files and behaviors, propose an alternative aligned with repo patterns rather than generic advice.

---

## Out of scope unless the PR introduces it

- Rewriting unrelated files for style.
- Replacing Tailwind/shadcn with another UI stack without product direction.
- Large refactors of mega-files unless the PR already targets that area — prefer follow-up tickets.
