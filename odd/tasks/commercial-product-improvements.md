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
1. Add persistent business settings and editable settings UI — pending
2. Add single-admin configurable authentication — complete
3. Strengthen cash register lifecycle and closure records — pending
4. Add product costs and historical margin snapshots — pending
5. Add daily operational report and export — pending
6. Add safe backup and restore — pending
7. Verify commercial flows and package build — pending

## Evidence
- Existing app already has products, sales, expenses, cash movements, exports, and SQLite persistence.
- Current settings are hard-coded/read-only; login is renderer-side hard-coded; cash close does not create an explicit closed state; no backup exists; products have no cost field.
