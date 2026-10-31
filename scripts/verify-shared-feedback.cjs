const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/main.tsx', 'utf8');
const styles = fs.readFileSync('src/styles.css', 'utf8');

assert.match(styles, /\.stats-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s, 'desktop metrics should distribute across five columns');
assert.match(styles, /\.stats-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, 'tablet metrics should use three columns');
assert.match(styles, /\.stats-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, 'mobile metrics should use two columns');
assert.match(source, /\{error && <div className="form-error" role="alert">\{error\}<\/div>\}/, 'login failures should be announced as an alert');
assert.match(source, /function Settings\([\s\S]*?setError\(error instanceof Error \? error\.message : '[^']+'\)/, 'settings failures should use an error state');
assert.match(source, /function Settings\([\s\S]*?\{error && <p className="form-error" role="alert">\{error\}<\/p>\}/, 'settings errors should render with error semantics');
assert.match(source, /function Settings\([\s\S]*?\{message && <p className="success-message" role="status">\{message\}<\/p>\}/, 'settings successes should render as status');

console.log('Shared visual and feedback contracts verified.');
