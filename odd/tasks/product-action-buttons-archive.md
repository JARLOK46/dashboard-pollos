# Product Actions and Archive

## Goal
Improve product action controls and allow safely archiving products from the Edit form.

## Scope
- Improve visual hierarchy and usability of Ajustar, Movimientos, and Editar actions.
- Add an archive action inside Editar with explicit confirmation.
- Preserve sales and inventory history; do not physically delete referenced products.

## Tasks
1. Add validated archive API using existing `active` flag — complete
2. Add archive control and improve action button styling — complete
3. Verify locally (no commit/push) — complete

## Acceptance criteria
- Product action buttons are visually distinct, accessible, and usable on narrow cards.
- Edit form exposes an archive action with clear destructive consequence and confirmation.
- Archived products disappear from active catalog/checkout without losing historical records.
- Errors are shown and refresh occurs after archive.
