# Vercel deployment (draft)

This document explains the **draft** root `vercel.json` and deployment options for Ad Compliance Hub (AAIRP).

## Architecture recap

| Layer | Location | Runtime |
|-------|----------|---------|
| Review UI | `apps/review-app` | Vite React SPA, `base: /review/` |
| API | `apps/api` | Fastify long-running Node server |
| Data | Postgres + Redis | Required at API startup (`DATABASE_URL`, `REDIS_URL`) |

**Integrated production (non-Vercel):** After `build:review-app`, API serves `apps/review-app/dist` at `/review/` via `register-demo-ui.ts`.

**Local dev:** `pnpm dev:review` (:5173) proxies `/demo` and `/health` to API (:3000).

## Option A — Frontend on Vercel + API elsewhere (recommended)

Use the root `vercel.json` as-is after replacing `REPLACE_WITH_API_HOST` with your API host (Railway, Render, Fly.io, Neon-backed VM, etc.).

1. Deploy API to a host that supports:
   - Persistent Node process (`node apps/api/dist/main.js`)
   - Outbound TCP to Postgres and Redis
   - Optional: build `review-app` and copy `dist` into API for same-origin `/review/` (no CORS)
2. Deploy Vercel project from this repo:
   - **Root directory:** repository root
   - **Build:** `pnpm build:review-app`
   - **Output:** `apps/review-app/dist`
3. Update `vercel.json` rewrites so `/demo/*`, `/health`, `/ready` proxy to the external API.
4. Set API env vars on the **API host** (see env table in deployment prep / `.env.example`).

**CORS note:** If the UI calls the API on a different origin without rewrites, configure Fastify CORS on the API. Same-origin rewrites avoid this.

## Option B — Full stack on Vercel (not supported without refactor)

The current API is **not** serverless-native:

- Fastify app with `listen()` and connection pools (Postgres `pg`, Redis `ioredis`)
- Review pipeline can exceed typical serverless timeouts
- PaddleOCR spawns local Python (not available on Vercel)

To run on Vercel you would need:

- Split routes into `@vercel/node` handlers or migrate to Hono/Fastify serverless adapter
- External Postgres (Neon) + Redis (Upstash) — already compatible
- Remove or replace PaddleOCR with cloud-only OCR
- Increase `maxDuration` on Pro for long reviews

**Recommendation:** Keep API off Vercel until a dedicated serverless entrypoint exists.

## vercel.json field reference

| Field | Value | Why |
|-------|-------|-----|
| `installCommand` | `pnpm install` | Monorepo uses pnpm workspaces |
| `buildCommand` | `pnpm build:review-app` | Builds shared-kernel + review-app |
| `outputDirectory` | `apps/review-app/dist` | Vite output |
| `framework` | `null` | Avoid auto-detection overriding monorepo paths |
| `redirects` | `/` → `/review/` | Match API integrated mode |
| `rewrites` | `/demo/*` → external API | SPA calls same-origin `/demo/review` |

Replace `https://REPLACE_WITH_API_HOST` before going live.

## Optional: same-origin without rewrites

Build UI into API and deploy only the API host:

```powershell
pnpm build:review-app
pnpm --filter @aairp/domain build
pnpm --filter @aairp/shared-kernel build
pnpm --filter @aairp/application build
pnpm --filter @aairp/infrastructure build
pnpm --filter @aairp/api build
# start: node apps/api/dist/main.js
```

Then point DNS to the API host only; skip Vercel for the review UI.

## Vercel project settings checklist

- Node.js version: **20.x** (see root `package.json` `engines`)
- Environment variables on Vercel: **none required for static UI-only** if rewrites proxy to API
- If using preview deployments: update rewrite destination or use Vercel env substitution (requires templating — not in static `vercel.json`; use Dashboard rewrites or `@vercel/config` later)
