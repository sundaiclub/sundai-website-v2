import twilio from 'twilio';

export type VerifiedTwilioWebhook =
  | { ok: true; params: URLSearchParams }
  | { ok: false; status: 403 | 503; message: string };

function publicWebhookUrl(requestUrl: string) {
  const incoming = new URL(requestUrl);
  const configuredOrigin =
    process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredOrigin) return incoming.toString();

  const configured = new URL(configuredOrigin);
  configured.pathname = incoming.pathname;
  configured.search = incoming.search;
  configured.hash = '';
  return configured.toString();
}

export async function verifyTwilioWebhook(
  request: Request
): Promise<VerifiedTwilioWebhook> {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return {
      ok: false,
      status: 503,
      message: 'Twilio webhook validation is not configured.',
    };
  }

  const signature = request.headers.get('x-twilio-signature') ?? '';
  const params = new URLSearchParams(await request.text());
  const values: Record<string, string> = {};
  params.forEach((value, key) => {
    values[key] = value;
  });

  if (
    !twilio.validateRequest(
      authToken,
      signature,
      publicWebhookUrl(request.url),
      values
    )
  ) {
    return { ok: false, status: 403, message: 'Invalid Twilio signature.' };
  }

  return { ok: true, params };
}

export function emptyTwimlResponse() {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { 'content-type': 'text/xml; charset=utf-8' },
  });
}
