# Sales Dashboard

## Goal
Build a Windows desktop sales-management dashboard for a chicken business using Electron, React, TypeScript, Vite, and local SQLite persistence.

## Scope
- Dashboard metrics
- Product catalog with images
- Sales checkout with cash/card and automatic change
- Sales history
- Expenses and cash tracking
- Excel export

## Non-goals
- Cloud synchronization
- Multi-user authentication
- Remote backend

## Tasks
1. Bootstrap Electron React TypeScript application — done (commit b6de44e; typecheck and production build passed)
2. Build local SQLite data layer — done (commit e9d12e6; typecheck and production build passed)
3. Implement product and sales workflows — done (commit 4793a56; typecheck and production build passed)
4. Implement dashboard history expenses and export — done (commits c50f8b1, d23991c; typecheck and production build passed)
5. Verify desktop build and core flows — done (typecheck, production build, and XLSX generation smoke test passed)

## Decisions
- Use Electron + React + TypeScript + Vite instead of React Native for Windows desktop.
- Use local SQLite for the first version.
- Work on branch `feat/sales-dashboard`.

## Evidence
- Repository cloned from `https://github.com/JARLOK46/dashboard-pollos.git`; repository was empty.
