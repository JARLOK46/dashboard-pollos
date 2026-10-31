const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('src/main.tsx', 'utf8');

const history = source.slice(source.indexOf('function History('), source.indexOf('function SaleDetailModal('));
assert.match(history, /salesRefreshVersion/);
assert.match(history, /\[range\.from, range\.to, payment, status, salesRefreshVersion\]/);
assert.doesNotMatch(history, /sales\.length/);
assert.match(source, /últimos 100 egresos/i);
assert.match(source, /expenses\.list\(100\)/);
console.log('History refresh and expense cap contract passed.');
