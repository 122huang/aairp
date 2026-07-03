# Sprint 6U — Review UI

React + TypeScript + shadcn/ui + Tailwind frontend on existing `POST /demo/review`.

| Task | Scope |
|------|--------|
| **6U-1** | Single review page — input, decision banner, findings + rewrites, source highlight |
| **6U-2** | Batch table — CSV import, verdict filter, row detail |
| **6U-3** | Export — print `report_html` from API |

**Stack:** `apps/review-app` (Vite), enums from `@aairp/shared-kernel`, API in `src/api/review.ts`.

**Serve:** `review-app` build output at `/review/` via Fastify static (replaces legacy `review-ui/public`).
