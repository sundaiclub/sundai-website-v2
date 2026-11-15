import { createVerify } from 'crypto';

export type SnsMessage = {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  Token?: string;
};

const certificates = new Map<string, Promise<string>>();

// SNS certificates and subscription links must come from an AWS SNS host.
export function isSnsUrl(value: unknown) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export function parseSnsMessage(text: string): SnsMessage | null {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    const required = [
      'Type',
      'MessageId',
      'TopicArn',
      'Message',
      'Timestamp',
      'SignatureVersion',
      'Signature',
      'SigningCertURL',
    ];
    return required.every(key => typeof value[key] === 'string')
      ? (value as unknown as SnsMessage)
      : null;
  } catch {
    return null;
  }
}

export function snsStringToSign(message: SnsMessage) {
  const keys =
    message.Type === 'Notification'
      ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
      : [
          'Message',
          'MessageId',
          'SubscribeURL',
          'Timestamp',
          'Token',
          'TopicArn',
          'Type',
        ];
  return keys
    .filter(key => message[key as keyof SnsMessage] !== undefined)
    .map(key => `${key}\n${message[key as keyof SnsMessage]}\n`)
    .join('');
}

async function downloadCertificate(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('SNS certificate download failed.');
  return response.text();
}

export async function verifySnsMessage(
  message: SnsMessage,
  getCertificate: (url: string) => Promise<string> = downloadCertificate
) {
  const algorithm =
    message.SignatureVersion === '1'
      ? 'RSA-SHA1'
      : message.SignatureVersion === '2'
        ? 'RSA-SHA256'
        : null;
  if (
    !algorithm ||
    !isSnsUrl(message.SigningCertURL) ||
    !new URL(message.SigningCertURL).pathname.endsWith('.pem')
  )
    return false;
  let certificate = certificates.get(message.SigningCertURL);
  if (!certificate) {
    certificate = getCertificate(message.SigningCertURL);
    certificates.set(message.SigningCertURL, certificate);
    certificate.catch(() => certificates.delete(message.SigningCertURL));
  }
  try {
    return createVerify(algorithm)
      .update(snsStringToSign(message))
      .verify(await certificate, message.Signature, 'base64');
  } catch {
    return false;
  }
}
