# Windows Packaging

## Goal
Make the Electron sales dashboard executable for Windows through a generated installer.

## Tasks
1. Configure Windows packaging — done (commit ce8d814)
2. Add app startup safeguards — done (packaged unpacked app generated successfully)
3. Build and verify Windows installer — corrected and regenerated (commit 00ec340; new installer build passed)

## Constraints
- Preserve local SQLite persistence.
- Keep renderer security settings enabled.
- Do not publish or push automatically.
