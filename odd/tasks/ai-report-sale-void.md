# AI Operational Report and Sale Void

## Goal
Add a read-only operational report tool and a confirmed sale-void tool to the AI assistant.

## Scope
1. `daily_report`: read-only report based on existing daily report data; no confirmation or mutation.
2. `void_sale`: proposal with sale number/details, reason, and explicit confirmation before using existing validated void API.

## Non-goals
- Excel report redesign in this work unit; track separately for a later feature.
- Automatic mutation from model output.

## Safety
The report is read-only. Sale voids remain proposal-only and require explicit confirmation.

## Tasks
1. Extend AI contracts and response data — complete (daily report guidance and strict void_sale proposal validation)
2. Add report rendering and sale-void confirmation — complete (structured metrics path and confirmed previews in floating/workspace AI)
3. Verify and package — evidence below; commit/push intentionally out of scope

## Acceptance criteria
- User can ask for today's operational report and receive clear sales, expenses, withdrawals, cash, profit, and alerts data.
- A requested sale void shows enough sale detail and requires a reason plus explicit confirmation.
- Cancel never mutates; confirm uses existing validated API and refreshes state.
- Excel improvements remain out of scope and are documented as next work.
