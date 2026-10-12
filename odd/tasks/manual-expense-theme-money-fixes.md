# Manual expense, theme, and COP money fixes

## Goal
Fix the reported manual-expense flow, make newly added audit/diagnostics/backup/checkout UI honor the existing light/dark theme, and preserve whole-peso COP semantics without destructive data conversion.

## Tasks
- [x] Reproduce and correct manual expense registration, including visible error handling and valid whole-peso payload.
- [x] Add semantic theme coverage for diagnostics, checkout, settings/backups, and status controls without changing light mode.
- [x] Audit and document COP whole-unit compatibility; remove misleading monetary UI cues without migrating stored values.
  - Compatibility note: `*_cents` names are legacy API/database fields, but stored and submitted values are whole COP pesos. Do not divide or multiply monetary values by 100; no migration or transformation is intended.
- [x] Run focused runtime checks, typecheck, CJS syntax checks, diff validation, and production build.

## Constraints
- Preserve unrelated existing working-tree changes.
- No commit, push, or release in this session.
- Existing database monetary values are not auto-converted.

## Evidence
- Manual repro with `amountCents: 25000`: closed register rejects atomically; after opening with `100000`, expense stores `25000` and cash movement stores `-25000`.
- COP formatter checks: `1099 -> $ 1.099`; `123456 -> $ 123.456`.
- `npm run typecheck`, all requested `node --check` commands, `git diff --check`, and `npm run build` passed.
- No automatic conversion was added; legacy `*_cents` names remain compatibility labels for whole COP pesos.
