# AI Chat Delete Confirmation

## Goal
Replace the browser-native chat deletion warning with a trustworthy, product-designed confirmation dialog.

## Scope
- Use an accessible in-app modal in both AI assistant surfaces.
- Clearly explain permanence and message deletion.
- Provide explicit cancel and destructive delete actions.
- Preserve the existing deletion and async safety behavior.

## Tasks
1. Add shared confirmation state and modal flow to both AI surfaces — complete
2. Style the destructive confirmation dialog for light and dark themes — complete
3. Verify accessibility, typecheck, and build — complete

## Acceptance criteria
- No browser-native `window.confirm` is used for AI chat deletion.
- The dialog names the chat and explains that its messages are permanently removed.
- Cancel/close leaves the chat untouched; delete performs the existing operation.
- The dialog is keyboard/focus understandable and visually consistent with the product.
