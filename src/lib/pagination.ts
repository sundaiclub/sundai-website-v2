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
