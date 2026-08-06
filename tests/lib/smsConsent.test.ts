describe('SMS consent configuration', () => {
  const originalVersion = process.env.NEXT_PUBLIC_SMS_CONSENT_VERSION;
  const originalCopy = process.env.NEXT_PUBLIC_SMS_CONSENT_COPY;

  afterEach(() => {
    if (originalVersion === undefined) {
      delete process.env.NEXT_PUBLIC_SMS_CONSENT_VERSION;
    } else {
      process.env.NEXT_PUBLIC_SMS_CONSENT_VERSION = originalVersion;
    }
    if (originalCopy === undefined) {
      delete process.env.NEXT_PUBLIC_SMS_CONSENT_COPY;
    } else {
      process.env.NEXT_PUBLIC_SMS_CONSENT_COPY = originalCopy;
    }
    jest.resetModules();
  });

  it('uses the public version and copy as the shared source of truth', () => {
    process.env.NEXT_PUBLIC_SMS_CONSENT_VERSION = 'consent-v3';
    process.env.NEXT_PUBLIC_SMS_CONSENT_COPY = 'Approved consent copy.';
    jest.resetModules();

    const consent = require('../../src/lib/smsConsent');

    expect(consent).toMatchObject({
      SMS_CONSENT_VERSION: 'consent-v3',
      SMS_CONSENT_COPY: 'Approved consent copy.',
      SMS_CONSENT_CONFIGURED: true,
    });
  });

  it('disables SMS consent when either public value is missing', () => {
    process.env.NEXT_PUBLIC_SMS_CONSENT_VERSION = 'consent-v3';
    delete process.env.NEXT_PUBLIC_SMS_CONSENT_COPY;
    jest.resetModules();

    const consent = require('../../src/lib/smsConsent');

    expect(consent.SMS_CONSENT_CONFIGURED).toBe(false);
  });
});
