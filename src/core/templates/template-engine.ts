const TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*fallback:\s*["']([^"']*)["'])?\s*\}\}/g;

function resolvePath(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

/**
 * Simple mustache‑like renderer used by the universal template system.
 * Supports `{{var}}` and `{{var | fallback: "default"}}`.
 */
export function renderTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  return template.replace(TOKEN_REGEX, (_match, varPath: string, fallbackValue?: string) => {
    const raw = resolvePath(variables, varPath);
    if (Array.isArray(raw)) {
      const joined = raw.filter(Boolean).join(', ');
      return joined.length > 0 ? joined : fallbackValue ?? '';
    }
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      return String(raw).trim();
    }
    return fallbackValue ?? '';
  });
}
