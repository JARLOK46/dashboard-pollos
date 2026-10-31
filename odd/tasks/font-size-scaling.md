# User-controlled typography scaling
Branch: `feat/ollama-cloud-ai`; add an operator-controlled text and numeric size preference to the existing Electron application.
Preserve the established warm pollería palette, current typography hierarchy, and operational behavior; this feature is text-only scaling with responsive component reflow, not whole-window zoom.

## Specs
- S1: “Listo quiero que hagamos algo nuevo y es lo siguiente, que se pueda cambiar el tamaño de letra, incluyendo el tamaño de los numeros, etc. los componentes se deben adpatar al tamaño de letra, etc.”
- S2: “Solo texto y números (recomendado)”

## Tasks
- T1 [S1-S2] Add an accessible Settings control with live preview/reset and device-local persistence; scale renderer text and numerals while components responsively reflow — route: `gentle-ai-worker` background with focused contract test — commit: pending.
- T2 [S1-S2] Verify bounds, persistence, accessibility, responsive layout, typecheck, full build/release, and visual proof where available — route: parent checks — commit: pending.

## Log
- L1: “Listo quiero que hagamos algo nuevo y es lo siguiente, que se pueda cambiar el tamaño de letra, incluyendo el tamaño de los numeros, etc. los componentes se deben adpatar al tamaño de letra, etc.”
- L2: User selected “Solo texto y números (recomendado)” over whole-interface zoom. Implementation will persist locally on the device, following the app's existing theme preference pattern. Proposed supported range: 85%–140% in 5% increments, default 100%; Settings will provide a reset control.
- L3: Previous whole-product UX feature remains separately tracked at `odd/tasks/experience-overhaul.md`; its T7 awaits the user opening the generated Windows release and providing updated visual feedback.
- L4: Design checkpoint: busy-counter operators need the option to enlarge prices, quantities, and labels while keeping the same information surface. Keep DM Sans/Plus Jakarta Sans, the existing warm palette, subtle borders/surfaces, and existing spacing; scale typography only and allow cards/controls to wrap or grow rather than changing application zoom. Device-local persistence follows the existing theme preference pattern.
