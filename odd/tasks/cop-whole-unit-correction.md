# COP whole-unit correction

## Goal
Display and accept monetary values as whole Colombian pesos (COP), preserving existing storage/API values without dividing or multiplying by 100.

## Scope
- Correct shared money formatting and COP/es-CO defaults.
- Correct monetary input/display conversions in AI previews, products, checkout, cash, and expenses.
- Correct backend AI presentation, alerts, CSV exports, and workbook report exports.
- Preserve quantity arithmetic, percentage calculations, storage schema, and unrelated working-tree changes.

## Checks
- `npm run typecheck`
- `git diff --check`
- Runtime formatter examples: `1099 -> $ 1.099` and `123456 -> $ 123.456` (COP whole units, locale-dependent spacing).

## Constraints
- No storage migration or invented conversion.
- No commit, push, or release per user request.
