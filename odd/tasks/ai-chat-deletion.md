# AI Chat History Deletion

## Goal
Allow users to permanently delete individual AI chat sessions from Historial in both assistant surfaces.

## Scope
- Delete a persisted AI session and its cascaded messages through IPC.
- Add a confirmed delete control to each history item.
- Keep the active-chat UI consistent after deleting the current or last session.
- Prevent stale in-flight responses from being persisted into a deleted session.

## Non-goals
- Bulk deletion.
- Cloud synchronization or recovery/trash.
- Deleting sales or other business records.

## Tasks
1. Add validated database delete function and IPC/preload bridge — complete
2. Add confirmed deletion UI and active-session fallback in both AI surfaces — complete
3. Verify cascade, error handling, and history behavior — complete

## Acceptance criteria
- A user must confirm before a chat is permanently deleted.
- Deleting a chat removes it and its messages from Historial after reload.
- Deleting the active chat selects another existing chat, or creates a fresh persisted chat when it was the last one.
- Both floating and dedicated AI interfaces expose the same behavior.
- Existing chat creation, message persistence, and history selection remain functional.
