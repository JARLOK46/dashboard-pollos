# Persistent AI Session History

## Goal
Persist every AI conversation session and show it in Historial across application restarts, shared by the floating assistant and dedicated Asistente IA workspace.

## Scope
- SQLite-backed sessions and messages.
- IPC/preload APIs to list, load, create, and append session messages.
- Shared session identity between both AI surfaces during one app run.
- History UI shows all saved sessions and can reopen them.

## Non-goals
- Cloud sync or multi-user sharing.
- Storing API keys or secrets in conversation records.
- Deleting history unless explicitly designed later.

## Tasks
1. Add durable schema, migration, database functions, and IPC bridge — complete
2. Replace in-memory-only conversation persistence in both AI surfaces — complete
3. Verify persistence, error handling, and history behavior — in progress (commit/push explicitly prohibited)

## Acceptance criteria
- Every session and message survives app restart.
- Both AI surfaces use the same persisted sessions.
- New chat creates a persisted session; sending persists user and assistant messages.
- Historial lists all sessions with title, message count, and updated time.
- Selecting a session restores its messages and context.
- Existing AI tools and confirmation flows remain functional.
