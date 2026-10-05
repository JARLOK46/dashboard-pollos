# Login and Cash Register

## Goal
Remove the settings section, add a session-only admin login, and implement a local cash register workflow.

## Credentials
- Email: admin@gmail.com
- Password: admin123*

## Constraints
- Session must be memory-only and end whenever the app process closes.
- Never persist the password or an authenticated session in SQLite/localStorage.
- Cash movements remain local in SQLite.

## Tasks
1. Remove settings and add session login — done (commit b9e3b4c; session is memory-only)
2. Implement cash register workflow — done (commit b9e3b4c; SQLite-backed opening, movements, balance, closing)
3. Verify secure session and cash flows — done (typecheck, build, and Windows release artifacts verified)

## Visual follow-up
- Dashboard visual system redesigned in commit 45815fe.
- Readability, animation, color, and typography pass in commit c8c2023.
- Windows release regenerated after the redesign.
