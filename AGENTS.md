# AGENTS.md

## Project workflow

This repository is a Windows Electron application named Pollo y Caja. Work on the current feature branch unless the user explicitly requests another branch.

### Required delivery workflow after every modification

After making any repository change:

1. Review the complete diff and confirm that only intended files changed.
2. Run the most relevant checks for the change. At minimum, run `npm run typecheck` for source changes and `git diff --check` before committing.
3. Create a Conventional Commit that describes the completed work.
4. Push the commit to the current GitHub feature branch.
5. Generate the Windows release with `npm run dist`.
6. Report the commit, push result, release path, and every check result.

Do not leave an implemented change uncommitted or unpublished unless a command fails or the user explicitly asks to pause. If a check, commit, push, or release fails, stop and report the exact failure before claiming completion.

The standard release outputs are:

- `release/Pollo y Caja Setup 0.1.0.exe`
- `release/win-unpacked/Pollo y Caja.exe`

Do not add unrelated generated files or local tooling state such as `.codegraph/` to feature commits without explicit user approval.

## Development checks

- TypeScript: `npm run typecheck`
- Production build: `npm run build`
- Windows installer: `npm run dist`
- Formatting validation: `npm run format:check`
- Whitespace validation: `git diff --check`

Preserve existing application behavior and language conventions. Keep tests, documentation, and task records with the behavior they describe.

## Git safety

- Never use force push unless the user explicitly authorizes it.
- Never rewrite published history.
- Never commit secrets, local databases, credentials, or unrelated generated artifacts.
- Push only the current intended feature branch.
