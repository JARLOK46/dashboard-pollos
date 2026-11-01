# Visual UX dashboard-pollos

## Goal
Improve the checkout product picker and sale detail panel, make Dashboard surfaces coherent in light and dark themes, and replace the sales bars with an accessible responsive SVG line chart. Preserve all sales, COP, payment, customer/notes, navigation, and keyboard behavior.

## Constraints
- Preserve existing functional changes in the worktree.
- No commit, push, or release in this session (explicit user request).
- Avoid new dependencies; use SVG for the chart.
- Keep CSS changes scoped and avoid mass formatting.

## Tasks
- [x] Redesign checkout search and product cards.
- [x] Reorganize sale detail panel sections without changing data flow.
- [x] Replace sales bars with SVG line chart, labels, tooltip/value access.
- [x] Harmonize dashboard states and diagnostic surfaces across themes.
- [x] Run typecheck, diff check, build, and format check where available.

## Evidence
- Existing modified files must remain intact unless directly related to this visual scope.
- `npm run typecheck`: passed.
- `git diff --check`: passed (only existing CRLF normalization warnings).
- `npm run build`: passed; Vite generated production assets successfully.
- `npm run format:check`: failed because Prettier reports style issues in six already-modified files (`src/main.tsx`, `src/styles.css`, `src/vite-env.d.ts`, `electron/database.cjs`, `electron/main.cjs`, `scripts/export-report.cjs`). No formatter rewrite was applied to avoid mass/unrelated formatting.
- No commit, push, or release performed per explicit user request.
