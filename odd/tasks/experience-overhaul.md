# Pollo & Caja whole-product experience overhaul
Branch: `feat/ollama-cloud-ai`; scope is usability, visual consistency, and operational clarity across the existing desktop app.
Preserve current business rules and the previously approved warm, tactile pollería-counter design direction unless the user changes it.

## Specs
- S1: “Quiero que mejores todo el software, quiero que lo mejores en usabilidad, en diseño, etc. Vamos a darle usa ODD, y sub agentes en background”

## Tasks
- T1 [S1] Audit primary workflows and rank evidence-backed UX findings — route: `gentle-ai-explore` background plus parent synthesis — commit: n/a (read-only); status: done.
- T2 [S1] Make COP the only supported currency and remove misleading currency editing without changing stored transaction amounts — route: parent implementation, test-first — commit: `7d1a5c6`; status: done.
- T3 [S1] Align dashboard period metrics/rankings and fix report loading, errors, and stale date-range results — route: parent implementation after T2 — commit: pending; status: in progress.
- T4 [S1] Fix history refresh signaling and clarify expense-list scope/filtering — route: parent or scoped worker after audit reconciliation — commit: pending.
- T5 [S1] Improve checkout and table-service discoverability while preserving payment and save semantics — route: parent or scoped worker after product semantics are confirmed — commit: pending.
- T6 [S1] Improve shared visual hierarchy, responsive/dark-theme consistency, and accessible status feedback — route: parent or scoped worker after audit reconciliation — commit: pending.
- T7 [S1] Verify public workflows, accessibility states, production build, and visual evidence — route: parent; independent verifier only if native assessment requires — commit: pending.

## Log
- L1: “Quiero que mejores todo el software, quiero que lo mejores en usabilidad, en diseño, etc. Vamos a darle usa ODD, y sub agentes en background”
- L2: User screenshots established that Gastos/Caja headings were mislabeled and the unopened-cash dot was green; those fixes are in commits `078969d` and `7054b65`. Dashboard expenses now use the selected range in `2d4af32`.
- L3: Read-only audit (`gentle-ai-explore`, task `mvvt0sps-3-2144`) found: configurable currency vs COP-only formatter (`src/main.tsx:143–145, 3590–3598`); dashboard best-seller ranking based on the latest 100 loaded sales rather than the selected period (`src/main.tsx:181, 1873–1880`); dashboard analytics without loading/error/stale-response handling (`src/main.tsx:1855–1858`); table picker without search (`src/main.tsx:3080–3086`) and asymmetric immediate-vs-dirty saves (`src/main.tsx:3043–3053, 3168–3170`); history refresh keyed to `sales.length` (`src/main.tsx:3770–3777`); expenses limited to 100 latest records (`src/main.tsx:4151–4155`); report date changes may show stale data and export failures are unhandled (`src/main.tsx:4013–4031, 4044–4046`); settings failures share success styling (`src/main.tsx:3480–3485, 3650–3652`); AI history-load failures look like empty history (`src/main.tsx:542–571`). Recommendations about card payment authorization and additional filtering remain unconfirmed product choices.
- L4: “The todo plan has not been reviewed during several tool-use turns. Check whether it still matches the work performed and update tasks where needed. Do not mark work done without verification.”
- L5: User selected “Fijar COP (recomendado)”: keep all amounts in COP and remove or disable editable currency; do not reinterpret or convert existing transaction amounts.
- L6: Test-first evidence for T2: `verify:currency-contract` failed before implementation because settings required an editable currency; after implementation, four isolated database tests pass, covering COP-only settings, rejection without partial writes, unchanged existing sale totals/items, and normalization of a legacy non-COP preference on database reopen. Also passed existing dashboard-expense, table, table-integration, and automatic-backup checks, TypeScript, CJS syntax, Vite build, and `git diff --check`.
- L7: T2 committed as `7d1a5c6` (`fix: keep currency settings fixed to COP`). No transaction amount was converted; the currency preference is normalized to COP.
