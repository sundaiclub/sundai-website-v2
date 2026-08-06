export const SMS_CONSENT_VERSION =
  process.env.NEXT_PUBLIC_SMS_CONSENT_VERSION?.trim() ?? '';

export const SMS_CONSENT_COPY =
  process.env.NEXT_PUBLIC_SMS_CONSENT_COPY?.trim() ?? '';

export const SMS_CONSENT_CONFIGURED = Boolean(
  SMS_CONSENT_VERSION && SMS_CONSENT_COPY
);
