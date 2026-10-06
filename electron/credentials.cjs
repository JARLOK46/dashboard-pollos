const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const KEY_FILE = 'ollama-cloud-key.bin';

function keyPath() { return path.join(app.getPath('userData'), KEY_FILE); }
function requireAvailable() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('El almacenamiento seguro no está disponible en este equipo.');
}
function validateKey(key) {
  if (typeof key !== 'string') throw new Error('La clave de API no es válida.');
  const value = key.trim();
  if (value.length < 10 || value.length > 512 || /\s/.test(value)) throw new Error('La clave de API no es válida.');
  return value;
}
function hasApiKey() {
  try { return fs.existsSync(keyPath()) && fs.statSync(keyPath()).size > 0; } catch { return false; }
}
function saveApiKey(key) {
  requireAvailable();
  const encrypted = safeStorage.encryptString(validateKey(key));
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(keyPath(), encrypted, { mode: 0o600 });
  return { configured: true };
}
function clearApiKey() {
  try { if (fs.existsSync(keyPath())) fs.unlinkSync(keyPath()); } catch { throw new Error('No se pudo eliminar la clave de API.'); }
  return { configured: false };
}
function getStatus() {
  return { configured: hasApiKey(), safeStorageAvailable: safeStorage.isEncryptionAvailable() };
}
module.exports = { saveApiKey, clearApiKey, getStatus };
