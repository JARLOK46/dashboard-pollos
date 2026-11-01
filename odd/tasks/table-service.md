# Table service and open orders

## Goal
Add a dining-room view to Dashboard Pollos to manage open table orders and convert them into normal recorded sales when paid.

## Scope
- Add 12 default dining tables and persistent open-order storage to SQLite schema version 7.
- Reserve available stock for open orders without decrementing inventory until payment; prevent direct sales, stock reductions, or product archiving from taking reserved units away.
- Preserve each item's price when first added to an order, allow order metadata/items to be edited, and support explicit discard with confirmation.
- Record cash/card payment as a regular sale linked to its table; cash payments require an open register, and stock/cash/inventory movement plus order release occur atomically.
- Add protected IPC/preload methods, a Spanish salon UI, dashboard/sidebar entry points, and show the table on sale details.

## Verification
- `npm run verify:tables`: isolated SQLite test covers default tables, saved price snapshots, stock reservation, failed/successful payment, cash movements, inventory movement, card sales, and discard.
- `npm run typecheck`
- `node --check` for Electron CommonJS files
- `git diff --check`
