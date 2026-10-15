const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const renderer = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.tsx'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');

assert.match(renderer, /const persistOrder = async \(nextCart/);
assert.match(renderer, /if \(delta > 0\) void persistOrder\(nextCart\)/);
assert.match(renderer, /Pendiente de pago/);
assert.match(renderer, /tables\.saveOrder/);
assert.match(main, /mesas: database\.listDiningTables\(\)/);
assert.match(main, /estado: table\.order_id \? 'pendiente_de_pago' : 'disponible'/);
assert.match(main, /database\.getTableOrder\(table\.id\)/);
console.log('table integration checks passed');
