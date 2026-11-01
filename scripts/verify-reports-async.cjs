const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.tsx'), 'utf8');
const start = source.indexOf('function Reports() {');
const end = source.indexOf('\nfunction Expenses(', start);
assert.notEqual(start, -1, 'Reports component exists');
assert.notEqual(end, -1, 'Reports component has a clear boundary');
const reports = source.slice(start, end);

assert.match(reports, /setReport\(null\)/, 'changing dates clears the previous report');
assert.match(reports, /setLoading\(true\)/, 'report loads expose a loading state');
assert.match(reports, /current\s*=\s*false/, 'obsolete report requests are invalidated');
assert.match(reports, /setError\(/, 'report loading failures are visible');
assert.match(reports, /setExporting\(true\)/, 'exports expose a busy state');
assert.match(reports, /catch\s*\(/, 'export failures are caught');
assert.match(reports, /disabled=\{exporting\}/, 'export buttons disable while busy');
console.log('Reports async-state contract verification passed.');
