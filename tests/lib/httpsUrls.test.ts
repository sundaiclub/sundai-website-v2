import {
  HttpsUrlInputError,
  normalizeHttpsUrl,
  normalizeOptionalHttpsUrl,
} from '@/lib/httpsUrls';

describe('HTTPS URL normalization', () => {
  it.each([
    ['example.com/path', 'https://example.com/path'],
    [' https://example.com/path ', 'https://example.com/path'],
    ['www.example.com', 'https://www.example.com/'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeHttpsUrl(input)).toEqual({
      valid: true,
      normalizedUrl: expected,
    });
  });

  it.each([
    [
      'http://example.com',
      'HTTP links are not supported. Use HTTPS or omit the protocol.',
    ],
    [
      'javascript:alert(1)',
      'The javascript: protocol is not supported. Enter an HTTPS website link or omit the protocol.',
    ],
    [
      'mailto:person@example.com',
      'The mailto: protocol is not supported. Enter an HTTPS website link or omit the protocol.',
    ],
    [
      '/relative/path',
      'Relative paths are not supported. Enter a domain, such as example.com/page.',
    ],
    [
      'not a URL',
      'URLs cannot contain spaces. Remove the spaces and try again.',
    ],
    ['', 'Enter a URL or leave this field empty.'],
  ])('explains why %s is rejected', (input, error) => {
    expect(normalizeHttpsUrl(input)).toEqual({ valid: false, error });
  });

  it('supports empty optional fields and reports invalid populated fields', () => {
    expect(normalizeOptionalHttpsUrl('', 'Website URL')).toBeNull();
    expect(() =>
      normalizeOptionalHttpsUrl('http://example.com', 'Website URL')
    ).toThrow(
      new HttpsUrlInputError(
        'Website URL: HTTP links are not supported. Use HTTPS or omit the protocol.'
      )
    );
  });
});
