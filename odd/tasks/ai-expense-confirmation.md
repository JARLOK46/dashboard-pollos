# AI Expense Confirmation

## Goal
Make the confirmed `create_expense` proposal visible and actionable in the dedicated Asistente IA workspace.

## Scope
- Reuse the existing expense proposal preview in the workspace.
- Keep explicit user confirmation as the only persistence path.
- Update copy so the assistant explains that it proposes actions but does not execute them without confirmation.
- Use the configured business currency where available.

## Tasks
1. Render the expense proposal card in `AIWorkspace` — complete
2. Align capability/disclaimer copy in AI surfaces — complete
3. Run typecheck and focused diff verification — complete

## Acceptance Criteria
- A valid AI `create_expense` response in the workspace shows editable description, amount, category, Cancel, and Confirm buttons.
- Confirming calls the existing expenses IPC exactly once and displays success.
- Canceling does not persist anything.
- Copy does not claim the assistant is strictly read-only while confirmed expense proposals are enabled.
- Existing chat behavior remains intact.

## Evidence
- `npm run typecheck` passed.
- Workspace now renders `ExpenseToolPreview`, loads the configured currency, and uses confirmation-aware copy.
