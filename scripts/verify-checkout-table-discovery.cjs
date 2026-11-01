const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/main.tsx'), 'utf8');
const checkoutStart = source.indexOf('function Checkout(');
const tablesStart = source.indexOf('function Tables(');
assert.notEqual(checkoutStart, -1, 'regular checkout component exists');
assert.notEqual(tablesStart, -1, 'table workflow component exists');
const checkout = source.slice(checkoutStart, tablesStart);
const tablePickerStart = source.indexOf('<section className="panel table-product-panel">');
const tableSidebarStart = source.indexOf('<aside className="panel table-order-panel', tablePickerStart);
assert.notEqual(tablePickerStart, -1, 'table-order product picker exists');
assert.notEqual(tableSidebarStart, -1, 'table-order cart remains after picker');
const tablesComponentStart = source.lastIndexOf('function Tables(', tablePickerStart);
const tableComponent = source.slice(tablesComponentStart, tableSidebarStart);
const tablePicker = source.slice(tablePickerStart, tableSidebarStart);

assert.match(checkout, /<img src=\{p\.image_path\} alt=\{p\.name\} \/>/, 'regular checkout product images use product names as alt text');
assert.match(tableComponent, /const \[tableProductSearch, setTableProductSearch\] = useState\(''\)/, 'table picker has a search query state');
assert.match(tablePicker, /\$\{product\.name\} \$\{product\.description\}/, 'table picker searches product name and description');
assert.match(tablePicker, /product\.stock > 0/, 'table picker continues to exclude out-of-stock products');
assert.match(tablePicker, /aria-label="Buscar producto por nombre o descripción"/, 'table picker search has an accessible label');
assert.match(tablePicker, /addProduct\(product, 1\)/, 'table picker retains add-to-cart action');
assert.match(tablePicker, /money\(product\.price_cents\)/, 'table picker retains product prices');
assert.match(tablePicker, /No hay productos que coincidan con la búsqueda\./, 'table picker provides an empty search state');
console.log('checkout-table-discovery checks passed');
