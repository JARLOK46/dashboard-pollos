# Automatic backup retention

## Goal
Keep at most one automatic backup file while preserving manual backups and manual restoration.

## Tasks
- [x] Replace date-based automatic backup destinations with a stable latest file.
- [x] Validate integrity and schema version before replacing the prior automatic file; clean only automatic temporary/legacy artifacts.
- [x] Update settings UI and type contract to explain latest-only automatic retention.
- [x] Add focused verification and run requested checks.

## Constraints
- Do not change currency or unrelated features.
- Do not commit, push, or generate a release in this task (explicit user request).
- Never delete manual backups or files outside the automatic-backup directory.

## Evidence
- `automatic-latest.sqlite` is written through a uniquely named temporary file and validated for SQLite integrity, schema version, and required tables before replacement.
- Existing automatic backups are preserved through a temporary previous name until the replacement succeeds; failures clean only automatic artifacts and retain the prior latest copy.
- Legacy date-prefixed automatic files and automatic sidecars are cleaned only inside the automatic backup directory; manual backup/restore IPC remains unchanged.
- Verification passed: `npm run verify:automatic-backup`, `npm run typecheck`, Node syntax checks for database/main/preload, `git diff --check`, and `npm run build`.
- No commit, push, or release was performed per explicit request.
