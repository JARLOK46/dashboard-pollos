# AI Confirmed Operational Tools

## Goal
Add three safe AI-proposed operational tools: cash withdrawal, stock adjustment, and product creation.

## Safety boundary
The model may only propose validated arguments. The renderer shows an editable preview. Persistence occurs only after explicit user confirmation through existing narrow IPC APIs.

## Scope
1. `cash_withdrawal`: amount and reason; requires an open cash register.
2. `stock_adjustment`: product, signed quantity delta, and reason; preserves inventory audit history.
3. `create_product`: name, description, price, cost, initial stock, and optional image selected by the user during confirmation.

## Non-goals
- Automatic execution from AI output.
- New database mutation APIs when existing validated APIs suffice.
- Sending image bytes to the model.

## Tasks
1. Extend backend proposal schema and validation — pending
2. Add reusable confirmation previews — pending
3. Integrate previews in floating chat and workspace — pending
4. Verify typecheck/build and manual flows — pending
5. Commit, push, and generate release — pending

## Acceptance criteria
- Each tool is allowlisted and strictly validated in the main process.
- Each proposal is editable and requires explicit confirmation.
- Withdrawal and stock adjustment call existing APIs only after confirmation.
- Product creation supports optional user-selected image, preview, replacement/removal, and the existing file-size/data-URI constraints.
- Cancel never persists changes.
- Successful confirmation cannot be accidentally submitted twice.
- Both AI surfaces render all three tools consistently.
