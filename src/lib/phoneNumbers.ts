const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizeSmsPhoneNumber(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  const compact = value.trim().replace(/[\s().-]/g, '');
  if (E164_PATTERN.test(compact)) return compact;
  if (!/^\d+$/.test(compact)) return null;
  if (compact.length === 10) return `+1${compact}`;
  if (compact.length === 11 && compact.startsWith('1')) return `+${compact}`;
  return null;
}

export function phoneNumberForStorage(value: string) {
  const trimmed = value.trim();
  return normalizeSmsPhoneNumber(trimmed) ?? trimmed;
}

export function phoneNumberLookupCandidates(value: string) {
  const normalized = normalizeSmsPhoneNumber(value);
  if (!normalized) return [value];

  const candidates = new Set([normalized]);
  if (normalized.startsWith('+1') && normalized.length === 12) {
    candidates.add(normalized.slice(1));
    candidates.add(normalized.slice(2));
  }
  return Array.from(candidates);
}
