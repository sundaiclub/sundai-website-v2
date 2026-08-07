const RETIRED_APPROVED_DETAIL_KEYS = new Set(['doorcode', 'toolkiturl']);

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/**
 * Removes retired approved-attendee fields from both new input and legacy JSON.
 * Approved details remain extensible, but these fields must no longer be stored
 * or disclosed under spelling/casing variants of their former keys.
 */
export function sanitizeApprovedDetailsJson<T>(value: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !RETIRED_APPROVED_DETAIL_KEYS.has(normalizeKey(key))
    )
  ) as T;
}
