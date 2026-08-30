export type HttpsUrlResult =
  | { valid: true; normalizedUrl: string }
  | { valid: false; error: string };

export class HttpsUrlInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HttpsUrlInputError';
  }
}

export function normalizeHttpsUrl(value: string): HttpsUrlResult {
  const trimmedUrl = value.trim();
  if (!trimmedUrl) {
    return { valid: false, error: 'Enter a URL or leave this field empty.' };
  }
  if (trimmedUrl.startsWith('/')) {
    return {
      valid: false,
      error:
        'Relative paths are not supported. Enter a domain, such as example.com/page.',
    };
  }
  if (/\s/.test(trimmedUrl)) {
    return {
      valid: false,
      error: 'URLs cannot contain spaces. Remove the spaces and try again.',
    };
  }

  const candidateUrl = /^[a-z][a-z\d+.-]*:/i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;

  try {
    const parsed = new URL(candidateUrl);
    if (parsed.protocol !== 'https:') {
      return parsed.protocol === 'http:'
        ? {
            valid: false,
            error:
              'HTTP links are not supported. Use HTTPS or omit the protocol.',
          }
        : {
            valid: false,
            error: `The ${parsed.protocol} protocol is not supported. Enter an HTTPS website link or omit the protocol.`,
          };
    }
    return { valid: true, normalizedUrl: parsed.toString() };
  } catch {
    return {
      valid: false,
      error: 'Enter a valid domain, such as example.com/page.',
    };
  }
}

export function normalizeOptionalHttpsUrl(
  value: unknown,
  fieldLabel: string
): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new HttpsUrlInputError(`${fieldLabel} must be a URL.`);
  }

  const result = normalizeHttpsUrl(value);
  if (!result.valid) {
    throw new HttpsUrlInputError(`${fieldLabel}: ${result.error}`);
  }
  return result.normalizedUrl;
}
