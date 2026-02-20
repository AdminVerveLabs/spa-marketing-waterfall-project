# Architecture Decision Records

## ADR-001: React SPA over n8n form/Supabase Table Editor
- **Date:** 2026-02-18
- **Decision:** Build a standalone React dashboard rather than using n8n's built-in form trigger or relying on Supabase Table Editor
- **Reasoning:** Need cascading metro dropdowns, run history tracking, and aggregate reporting. n8n forms are too limited. Supabase Table Editor doesn't support custom UIs or workflow triggering. A lightweight React app gives us exactly the UX we need with minimal overhead.
- **Trade-off:** Extra deployment (Docker container on Coolify) but trivial resource cost

## ADR-002: Static metro data over API/database lookup
- **Date:** 2026-02-18
- **Decision:** Embed city/state/country data as a static TypeScript file rather than fetching from an API or Supabase table
- **Reasoning:** Metro data changes extremely rarely. A static file loads instantly (no API latency), works offline, and is easy to update by editing the file. Adding ~200 metros to a .ts file is maybe 10KB.
- **Trade-off:** Adding a new city requires a code change + redeploy. Acceptable for an internal tool.

## ADR-003: Lovable for scaffolding, Claude Code for integration
- **Date:** 2026-02-18
- **Decision:** Use Lovable to rapidly scaffold the React app (pages, components, routing, styling) then use Claude Code to wire up real Supabase connections, n8n webhooks, Docker deployment
- **Reasoning:** Lovable excels at going from spec → working UI fast. Claude Code excels at infrastructure integration, debugging, and working within existing repo conventions. Playing to each tool's strengths.
- **Trade-off:** Two-step process, but net faster than doing everything in one tool

## ADR-004: Fire-and-forget webhook, no real-time updates
- **Date:** 2026-02-18
- **Decision:** Dashboard triggers n8n webhook and immediately redirects to confirmation. No WebSocket/polling for live status updates. Users refresh manually.
- **Reasoning:** Pipeline runs take 15-30 minutes. Real-time updates add significant complexity (Supabase subscriptions, reconnection logic, UI state management) for marginal UX benefit on a 2-user internal tool. Simple "check back later" is fine.
- **Trade-off:** Users won't see the exact moment a run completes. They'll see it on next page load.

## ADR-005: Single webhook endpoint for full pipeline
- **Date:** 2026-02-18
- **Decision:** One webhook URL triggers the entire pipeline (Steps 1-5), not individual steps
- **Reasoning:** Simplest approach. The dashboard's job is "run this metro" — the pipeline handles step orchestration. If granular step triggering is needed later, we can add separate webhook paths.
- **Trade-off:** Can't re-run just Step 3 for a metro from the dashboard. Must re-run everything. Acceptable for now.

## ADR-006: Direct prototype extraction over Lovable scaffold
- **Date:** 2026-02-19
- **Decision:** Skipped Lovable entirely. Decomposed the 1019-line `vervelabs-run-manager.jsx` prototype directly into a proper TypeScript SPA.
- **Reasoning:** The prototype was already a complete, working UI with all pages, components, and styling. Running it through Lovable would have added an unnecessary step — Lovable would just generate code we'd need to restructure anyway. Direct extraction preserves the exact visual design pixel-for-pixel.
- **Trade-off:** None. Faster and more accurate than the Lovable round-trip.

## ADR-007: lucide-react over inline SVGs
- **Date:** 2026-02-19
- **Decision:** Replaced all 16 inline SVG icon components from the prototype with `lucide-react` imports.
- **Reasoning:** lucide-react was already a dependency. Named imports (`<Play size={16} />`) are more readable, tree-shakeable, and consistent than inline SVG markup. Reduces component file sizes.
- **Trade-off:** None. Strictly better.

## ADR-008: Auth context pattern for session management
- **Date:** 2026-02-19
- **Decision:** Single `AuthProvider` context wrapping the entire app, with `useAuth()` hook for components to access session/signIn/signOut.
- **Reasoning:** Single source of truth for auth state. Avoids redundant `supabase.auth.getSession()` calls in every component. Session changes propagate automatically via `onAuthStateChange`.
- **Trade-off:** All components re-render on auth state change, but this only happens on login/logout — negligible impact.

## ADR-010: Client-side .xlsx generation over server-side export
- **Date:** 2026-02-19
- **Decision:** Use SheetJS (`xlsx` npm package) to generate .xlsx files in the browser rather than creating a server-side export endpoint.
- **Reasoning:** No backend to add an endpoint to — the dashboard is a static SPA served by Nginx. Supabase queries are already done client-side. SheetJS can build the workbook entirely in the browser and trigger a download. No additional infrastructure needed.
- **Trade-off:** Bundle size increases ~290KB (uncompressed). Acceptable for an internal tool. If the dataset grows very large (10k+ rows), we'd need to consider streaming or server-side generation.

## ADR-009: Client-side dashboard stats over database view
- **Date:** 2026-02-19
- **Decision:** Dashboard stat cards (metros covered, companies found, contacts found, runs this month) computed client-side from the fetched runs array.
- **Reasoning:** Dashboard already fetches the last 10 runs. Computing 4 aggregates from 10 records is trivial. Creating a separate DB view for dashboard stats would add schema complexity for no real performance benefit on a 2-user tool.
- **Trade-off:** Stats based on last 10 runs only, not all runs. Acceptable for dashboard overview — full stats are on the Coverage page.
