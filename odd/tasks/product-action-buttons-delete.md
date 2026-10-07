# Product Actions and Delete UX

## Goal
Place product actions at the card end, replace archive wording with delete wording, and provide a polished confirmation dialog.

## Safety decision
User-facing operation is named delete, but implementation remains a soft delete (`active = 0`) to preserve historical sales and inventory records.

## Tasks
1. Align action row to card end — complete
2. Replace archive copy and add styled confirmation dialog — complete
3. Verify locally — complete (no commit or push per request)

## Acceptance criteria
- Product action buttons sit at the far end/right of the card where responsive layout permits.
- The user sees “Eliminar producto”, not “Archivar”. ✅
- Confirmation uses an accessible in-app modal with product name, preservation explanation, Cancelar/destructive Eliminar producto actions, Escape/backdrop close, busy state, and inline errors. ✅
- A branded accessible confirmation dialog explains consequences and offers Cancelar/Eliminar producto.
- Delete preserves historical records and removes the product from active catalog/checkout.
