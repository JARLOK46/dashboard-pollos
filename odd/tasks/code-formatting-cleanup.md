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
2. Format renderer source in a bounded slice — complete
3. Format Electron/main-process source in a bounded slice — credentials and config formatting complete; remaining repository format check is blocked by pre-existing `src/styles.css` drift
4. Verify, commit, push, and package — pending

## Evidence
- `electron/credentials.cjs` and `tsconfig.node.json` were formatted with Prettier without changing strings or behavior.
- `npm run typecheck` passes.
- `npm run format:check` still reports only `src/styles.css`; that file is outside this bounded formatting work unit.

## Non-goals
- Functional redesign.
- Prompt wording changes.
- API/schema changes.
- Broad refactors mixed with formatting.
