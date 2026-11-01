const REMOTE_METHOD_PREFIX = /^Error invoking remote method ['"][^'"]+['"]:\s*/i;
const ERROR_PREFIX = /^(?:Uncaught\s+)?Error:\s*/i;
const IMPLEMENTATION_DETAILS = /(?:\b(?:SQLITE_[A-Z_]+|ERR_[A-Z0-9_]+|IPC[A-Z0-9_]*|ipcRenderer|invoke|TypeError|ReferenceError|SyntaxError)\b|Cannot read properties of|is not a function|is not defined|\n\s*at\s+.+:\d+:\d+)/i;

export function userFacingError(cause: unknown, fallback: string): string {
  const raw = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  let message = raw.trim();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const withoutRemotePrefix = message.replace(REMOTE_METHOD_PREFIX, '').trim();
    const withoutErrorPrefix = withoutRemotePrefix.replace(ERROR_PREFIX, '').trim();
    if (withoutErrorPrefix === message) break;
    message = withoutErrorPrefix;
  }

  if (!message || IMPLEMENTATION_DETAILS.test(message)) return fallback;
  if (message.includes('La caja no está abierta'))
    return 'Para registrar una venta en efectivo, primero abrí la caja desde Control de caja.';
  return message;
}
