const fs = require('node:fs');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.tsx', 'utf8');
const css = fs.readFileSync('src/styles.css', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.match(packageJson.scripts['verify:font-scaling'], /verify-font-scaling\.cjs/);
assert.match(source, /pollo-caja-font-scale/);
assert.match(source, /const DEFAULT_FONT_SCALE = 100/);
assert.match(source, /document\.documentElement\.style\.setProperty\('--text-scale', String\(scale \/ 100\)\)/);
assert.match(source, /min=\{85\}/);
assert.match(source, /max=\{140\}/);
assert.match(source, /step=\{5\}/);
assert.match(source, /aria-label="Tamaño del texto"/);
assert.match(source, /aria-live="polite"/);
assert.match(source, /Restablecer/);
assert.match(source, /Math\.min\(140, Math\.max\(85,/);
assert.match(source, /setProperty\('--text-scale'/);

const declarations = [...css.matchAll(/font-size\s*:\s*([^;}]+)/g)];
assert.ok(declarations.length > 250, `Expected broad existing CSS typography, found ${declarations.length}`);
assert.match(source, /function scaleStylesheetFontSizes\(\)/);
assert.match(source, /rule\.style\.getPropertyValue\('font-size'\)/);
assert.match(source, /getPropertyPriority\('font-size'\)/);
assert.match(source, /setProperty\(\s*'font-size'/);
assert.match(source, /calc\(\(\$\{current\}\) \* var\(--text-scale, 1\)\)/);
assert.match(source, /const ICON_ONLY_SELECTOR =/);
for (const iconSelector of [
  '\\.brand-mark',
  '\\.stat-icon',
  '\\.action-icon',
  '\\.nav-item\\s+span',
  '\\.theme-toggle',
  '\\.product-image',
  '\\.search-icon',
  '\\.diagnostic-arrow',
  '\\.empty-chart\\s+span',
  '\\.table-clear-icon',
  '\\.card-menu',
]) {
  assert.ok(source.includes(iconSelector), `Expected icon exemption for ${iconSelector}`);
}
assert.match(source, /toggleAttribute\('data-font-scale-large', scale > DEFAULT_FONT_SCALE\)/);
assert.match(source, /if \(sheet\.cssRules\) visit\(sheet\.cssRules\)/);
assert.match(css, /overflow-wrap:\s*anywhere/);
assert.match(css, /min-width:\s*0/);
assert.match(css, /flex-wrap:\s*wrap/);
assert.match(css, /:root\[data-font-scale-large\] \.checkout-layout,\s*:root\[data-font-scale-large\] \.content-grid/);
assert.doesNotMatch(css, /(?:^|\n)\s*\.checkout-layout[^{}]*\{[^}]*grid-template-columns:\s*repeat\(auto-fit/);
assert.doesNotMatch(css, /(?:^|\n)\s*\.content-grid[^{}]*\{[^}]*grid-template-columns:\s*repeat\(auto-fit/);
assert.match(css, /font-scale-range/);
console.log(`Font scaling contract verified (${declarations.length} font-size declarations inspected; icon selectors exempt).`);
