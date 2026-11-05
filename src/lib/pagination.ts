export function parseNonNegativeInteger(
  value: string | null,
  defaultValue: number
): number | null {
  if (value === null) return defaultValue;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function parsePageSize(
  value: string | null,
  defaultValue: number,
  maximum: number
): number | null {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return null;
  return Math.min(parsed, maximum);
}

// A 1-based page number. Missing values use the first page.
export function parsePageNumber(value: string | null): number | null {
  if (!value) return 1;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
