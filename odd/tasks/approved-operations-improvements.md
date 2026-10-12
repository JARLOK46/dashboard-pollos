# Approved operations improvements

## Scope
Implement approved improvements only: auditability, professional Excel exports, faster checkout, deterministic inconsistency diagnostics, and automatic validated backups. Explicitly exclude roles/permissions and authentication redesign. Preserve unrelated working-tree changes.

## Tasks
- [ ] Add audit event persistence and actor-safe mutation logging.
- [ ] Add deterministic inconsistency diagnostics and visible dashboard access.
- [ ] Harden automatic daily/closing backups with retention, validation, and visible status.
- [ ] Upgrade filtered Excel exports without breaking CSV.
- [ ] Improve checkout search, frequent products, shortcuts, and submission flow.
- [ ] Run focused checks and required build/dist verification; review diff.

## Conservative assumptions
- Existing authenticated email is the actor identity; when unavailable, use explicit `local-operator`.
- Automatic backups use an app-data subfolder unless an existing configurable backup setting is available; manual backups remain unchanged.
- Existing sales filters are the source of truth for export scope.
- No PDF work and no roles/permissions work.

## Evidence
- Created before source edits per ODD.
- Backend, export, renderer, and backup work completed without changing roles or authentication.
- `npm run typecheck`, `git diff --check`, CJS syntax checks, build, and XLSX smoke verification passed.
- `npm run format:check` reports formatting differences in six modified files; formatting was not mass-applied to avoid rewriting unrelated existing code.
- `npm run dist` reached electron-builder but failed with Windows `EPERM` renaming `release/win-unpacked.tmp` to `release/win-unpacked`, likely because the existing unpacked release directory is locked/in use. No cleanup or deletion was performed.
- No commit or push was created, per explicit user instruction.
