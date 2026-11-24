/** Keep credentials and private download links out of persisted diagnostics. */
export function safeMediaDiagnosticText(input: unknown, limit: number): string {
  return String(input ?? '')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[URL removed]')
    .replace(/Bearer\s+[^\s"',}]+/gi, 'Bearer [removed]')
    .replace(/((?:token|authorization|password|api[_-]?key)\s*["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi, '$1[removed]')
    .slice(0, limit);
}

export function mediaErrorServerDetails(error: unknown): string {
  const value = (error || {}) as {
    status?: unknown;
    status_?: unknown;
    customData?: { serverResponse?: unknown };
    serverResponse?: unknown;
  };
  const status = String(value.status ?? value.status_ ?? '');
  let response = value.customData?.serverResponse ?? value.serverResponse;
  if (typeof response === 'string' && response) {
    try {
      const parsed = JSON.parse(response);
      response = parsed?.error?.message || parsed?.message || response;
    } catch {
      // Plain-text error bodies are also useful, after sanitization.
    }
  }
  return [
    /^[1-5]\d\d$/.test(status) ? `HTTP ${status}` :
      status === '0' ? 'Aucune réponse HTTP' : '',
    safeMediaDiagnosticText(response, 300),
  ].filter(Boolean).join(' : ');
}
