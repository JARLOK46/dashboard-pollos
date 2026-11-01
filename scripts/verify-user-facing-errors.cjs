const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const helperPath = path.join(__dirname, '../src/error-messages.ts');
const helperSource = fs.readFileSync(helperPath, 'utf8');
const runnableSource = helperSource.replace(
  'export function userFacingError(cause: unknown, fallback: string): string {',
  'function userFacingError(cause, fallback) {',
) + '\nmodule.exports = { userFacingError };';
const sandboxModule = { exports: {} };
vm.runInNewContext(runnableSource, { module: sandboxModule, exports: sandboxModule.exports, Error });
const { userFacingError } = sandboxModule.exports;

assert.equal(
  userFacingError(new Error("Error invoking remote method 'sales:create': Error: El precio no es válido."), 'No se pudo guardar.'),
  'El precio no es válido.',
  'remote-method wrapper should be removed while preserving useful validation text',
);
assert.equal(
  userFacingError(new Error("Error invoking remote method 'products:list': Error: SQLITE_ERROR: no such table"), 'No se pudieron cargar los productos.'),
  'No se pudieron cargar los productos.',
  'database implementation details should use the operation fallback',
);
assert.equal(
  userFacingError(new Error('TypeError: Cannot read properties of undefined (reading id)'), 'No se pudo completar la acción.'),
  'No se pudo completar la acción.',
  'runtime implementation errors should use the operation fallback',
);
assert.equal(
  userFacingError(new Error('La caja no está abierta. Abrí la caja antes de registrar movimientos de efectivo.'), 'No se pudo guardar.'),
  'Para registrar una venta en efectivo, primero abrí la caja desde Control de caja.',
  'existing helpful cash guidance should remain',
);
assert.equal(
  userFacingError(new Error('Ollama Cloud rechazó la solicitud (HTTP 503).'), 'No se pudo conectar.'),
  'Ollama Cloud rechazó la solicitud (HTTP 503).',
  'useful provider-facing messages should remain',
);

const renderer = fs.readFileSync(path.join(__dirname, '../src/main.tsx'), 'utf8');
assert.doesNotMatch(renderer, /setError\(\s*(?:cause|error)\s+instanceof\s+Error\s*\?\s*(?:cause|error)\.message/);
assert.doesNotMatch(renderer, /set(?:History|Load)Error\(\s*(?:cause|error)\s+instanceof\s+Error\s*\?\s*(?:cause|error)\.message/);
assert.doesNotMatch(renderer, /\$\{(?:exportError|loadError)\.message\}/);
assert.match(renderer, /userFacingError\(toolError, 'No se pudo completar la acción\.'/);
console.log('User-facing error normalization passed (6 behavior and coverage checks).');
