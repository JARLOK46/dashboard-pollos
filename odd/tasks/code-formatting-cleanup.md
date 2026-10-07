# Code Formatting and Clean Code Cleanup

## Goal
Improve source readability and maintainability without changing runtime behavior.

## Approach
- Establish pinned formatting tooling and repository configuration.
- Format source in bounded file-level work units.
- Preserve AI prompt literal contents and public IPC/API behavior.
- Validate every work unit with typecheck/build and inspect diffs for semantic changes.

## Tasks
1. Add formatter configuration and scripts — complete
2. Format renderer source in a bounded slice — pending
3. Format Electron/main-process source in a bounded slice — pending
4. Verify, commit, push, and package — pending

## Non-goals
- Functional redesign.
- Prompt wording changes.
- API/schema changes.
- Broad refactors mixed with formatting.
