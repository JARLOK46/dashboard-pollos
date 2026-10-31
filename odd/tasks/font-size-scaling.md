# User-controlled typography scaling
Branch: `feat/ollama-cloud-ai`; add an operator-controlled text and numeric size preference to the existing Electron application.
Preserve the established warm pollería palette, current typography hierarchy, and operational behavior; this feature is text-only scaling with responsive component reflow, not whole-window zoom.

## Specs
- S1: “Listo quiero que hagamos algo nuevo y es lo siguiente, que se pueda cambiar el tamaño de letra, incluyendo el tamaño de los numeros, etc. los componentes se deben adpatar al tamaño de letra, etc.”
- S2: “Solo texto y números (recomendado)”

## Tasks
- T1 [S1-S2] Add a visible, accessible text-size control in Settings with live preview, reset-to-default, and device-local persistence — route: `gentle-ai-worker` background — commit: pending.
- T2 [S1-S2] Scale text and numeric displays across the renderer while allowing cards, forms, tables, and navigation to reflow without clipping; preserve colors, icon meaning, and operation behavior — route: `gentle-ai-worker` background — commit: pending.
- T3 [S1-S2] Verify scale boundaries, persistence, accessibility, responsive layout, TypeScript, full build, and final visual proof where available — route: parent checks — commit: pending.

## Log
- L1: “Listo quiero que hagamos algo nuevo y es lo siguiente, que se pueda cambiar el tamaño de letra, incluyendo el tamaño de los numeros, etc. los componentes se deben adpatar al tamaño de letra, etc.”
- L2: User selected “Solo texto y números (recomendado)” over whole-interface zoom. Implementation will persist locally on the device, following the app's existing theme preference pattern. Proposed supported range: 85%–140% in 5% increments, default 100%; Settings will provide a reset control.
- L3: Previous whole-product UX feature remains separately tracked at `odd/tasks/experience-overhaul.md`; its T7 awaits the user opening the generated Windows release and providing updated visual feedback.
