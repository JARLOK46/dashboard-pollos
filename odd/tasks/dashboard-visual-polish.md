# Dashboard visual polish

## Goal
Improve only the visual treatment of the Dashboard `Diagnóstico de datos` panel and the `Buscar producto` control in `Nueva venta`, without changing sales or diagnostics behavior.

## Tasks
- [x] Refine diagnostics hierarchy, semantic states, theme support, and focus treatment.
- [x] Refine product search affordances, shortcut, result count, responsive behavior, and theme support.
- [x] Verify with typecheck, diff check, build, and final diff review.

## Constraints
- Preserve existing keyboard behavior and filtering logic.
- No commit, push, or release.
- Keep changes targeted; do not mass-format.

## Evidence
- `npm run typecheck` — passed.
- `git diff --check` — passed; Git emitted the existing LF/CRLF normalization warning for `src/styles.css`.
- `npm run build` — passed (15 modules transformed).
- Final source diff is limited to `src/main.tsx` and `src/styles.css`.
- No commit, push, or release performed by request.
