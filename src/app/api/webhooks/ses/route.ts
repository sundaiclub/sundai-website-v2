import { applySesEvent, type SesEvent } from '@/lib/sesEvents';
import { isSnsUrl, parseSnsMessage, verifySnsMessage } from '@/lib/snsMessages';

export const runtime = 'nodejs';

// Receives SES delivery, bounce, complaint, and reject events through an SNS
// topic subscription. Only signed messages from the configured topic count.
export async function POST(request: Request) {
  const topicArn = process.env.AWS_SES_EVENTS_TOPIC_ARN;
  if (!topicArn)
    return new Response('SES event tracking is not configured.', {
      status: 503,
    });

  const message = parseSnsMessage(await request.text());
  if (!message) return new Response('Invalid SNS message.', { status: 400 });
  if (message.TopicArn !== topicArn || !(await verifySnsMessage(message)))
    return new Response('Invalid SNS signature.', { status: 403 });

  if (message.Type === 'SubscriptionConfirmation') {
    if (!isSnsUrl(message.SubscribeURL))
      return new Response('Invalid subscription URL.', { status: 400 });
    const confirmed = await fetch(message.SubscribeURL!);
    return new Response(null, { status: confirmed.ok ? 204 : 502 });
  }
  if (message.Type !== 'Notification')
    return new Response(null, { status: 204 });

  let event: SesEvent;
  try {
    event = JSON.parse(message.Message) as SesEvent;
  } catch {
    return new Response(null, { status: 204 });
  }
  try {
    await applySesEvent(event);
  } catch (error) {
    console.error('[SES_EVENT_WEBHOOK]', error);
    // SNS retries failed deliveries.
    return new Response('Unable to save the SES event.', { status: 500 });
  }
  return new Response(null, { status: 204 });
}
