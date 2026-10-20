# Commercial Product Improvements

## Goal
Turn Pollo & Caja into a sellable local control system for small pollerías, centered on daily cash control.

## Customer
A single small chicken shop, one location, primarily counter sales, with one owner/admin.

## Scope
1. Business configuration: editable business identity, currency, and low-stock threshold.
2. Stronger cash control: explicit daily register lifecycle, closure, difference, and movement reasons.
3. Backup and restore: safe database backup/restore with user confirmation and validation.
4. Configurable authentication: one persisted admin password hash, memory-only session.
5. Daily report: sales, expenses, payment split, expected/counted cash, and result estimate.
6. Product cost and margin: product costs and sale-time cost snapshots for historical margin.

## Non-goals
- Employee roles or multi-user permissions in this version.
- Cloud synchronization, delivery, mobile app, electronic invoicing, and multi-branch support.

## Decisions
- Implement in bounded work units with tests/checks after each unit.
- Preserve local SQLite and local business-time operation.
- Use a single configurable administrator; do not persist authenticated sessions.
- Snapshot product cost on each sale to preserve historical margins.

## Tasks
1. Add persistent business settings and editable settings UI — complete
2. Add single-admin configurable authentication — complete
3. Strengthen cash register lifecycle and closure records — complete
4. Add product costs and historical margin snapshots — complete
5. Add cash withdrawal movements and daily report visibility — complete
6. Add daily operational report and export — complete (commit a166365; daily net-result calculation, report UI card, CSV export line endings and net-result row, corrected XLSX net-result formula)
7. Add safe backup and restore — complete
8. Verify commercial flows and package build — complete (commit a166365; typecheck, syntax checks, diff hygiene, production build, and Windows NSIS packaging pass)

## Evidence
- Existing app already has products, sales, expenses, cash movements, exports, and SQLite persistence.
- Persistent settings, secure single-admin authentication, explicit cash closure, product cost snapshots, safe validated backup/restore, daily operational reporting, and Windows packaging are implemented; the dashboard is ready for manual review.
- Task 6 evidence: daily reporting is available from the Reportes screen with local business date selection, sales/payment/cost/gross-margin/expense/cash metrics, and net-result estimate. CSV and XLSX exports include the same operational summary; CSV uses real line endings and XLSX calculates net result after cost of sales and expenses.
- Backup evidence: main-process save/open dialogs expose backup and restore IPC; backups checkpoint WAL and use temporary replacement; restores validate integrity, schema version, and required tables, then replace the active database path while reopening the handle; Settings exposes explicit backup/restore controls and status feedback.
- Verification evidence: `npm run typecheck`, CJS syntax checks, `git diff --check`, `npm run build`, and `npm run dist` pass. electron-builder generated the unpacked app and NSIS installer on 2026-10-20; installer output is `release/Pollo y Caja Setup 0.1.0.exe` and unpacked output is `release/win-unpacked/Pollo y Caja.exe`.
