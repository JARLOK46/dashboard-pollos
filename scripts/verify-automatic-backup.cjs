const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const database = fs.readFileSync(path.join(root, 'electron/database.cjs'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
const env = fs.readFileSync(path.join(root, 'src/vite-env.d.ts'), 'utf8');

assert.match(database, /const AUTOMATIC_BACKUP_RETENTION = 1;/);
assert.match(database, /const AUTOMATIC_BACKUP_FILENAME = 'automatic-latest\.sqlite';/);
assert.match(database, /const destination = path\.join\(directory, AUTOMATIC_BACKUP_FILENAME\);/);
assert.match(database, /validateDatabaseFile\(temporaryPath\);/);
assert.match(database, /if \(fs\.existsSync\(destination\)\) fs\.renameSync\(destination, previousPath\);/);
assert.match(database, /if \(fs\.existsSync\(previousPath\)\) fs\.renameSync\(previousPath, destination\);/);
assert.match(database, /function cleanAutomaticArtifacts\(directory\)/);
assert.match(database, /cleanAutomaticArtifacts\(directory\);/);
assert.doesNotMatch(database, /const businessDate = getBusinessDate\(\);/);

const createOffset = database.indexOf('async function createAutomaticBackup');
const validationOffset = database.indexOf('validateDatabaseFile(temporaryPath)', createOffset);
const replacementOffset = database.indexOf('fs.renameSync(temporaryPath, destination)', createOffset);
assert(validationOffset >= 0 && validationOffset < replacementOffset, 'temporary backup must be validated before replacement');

assert.match(main, /Copias automáticas \(solo la última\)/);
assert.match(main, /retention: 1;/);
assert.match(env, /retention: 1;/);

const syntax = spawnSync(process.execPath, ['--check', path.join(root, 'electron/database.cjs')], {
  encoding: 'utf8',
});
assert.equal(syntax.status, 0, syntax.stderr || 'database.cjs syntax check failed');

console.log('Automatic backup retention verification passed.');
