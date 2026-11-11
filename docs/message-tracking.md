# Message delivery and click tracking

Organizer event messages and weekly emails keep one private recipient row per
person. Organizer and admin pages show only totals: delivered rate, failure
rate, grouped failure reasons with hints, spam complaints, unsubscribes, link
clicks, and RSVPs after a click. Recipient contact details are not shown.

## Email and SMS groups

The organizer page creates the email and SMS drafts of one send with the same
`sendGroupId`. Event history and `/admin/communications` show the group as one
entry with separate results for each channel. The migration
`20261105000000_message_delivery_tracking` groups earlier sends when the SMS
and email drafts came from the same organizer and audience within 60 seconds.

## Email delivery events (SES)

Each environment has its own SES configuration set and SNS topic so that events
reach the deployment that sent the email:

| Environment | Configuration set | SNS topic | Webhook |
| --- | --- | --- | --- |
| Production | `sundai-prod-email-events` | `sundai-prod-ses-events` | `https://www.sundai.club/api/webhooks/ses` |
| v3 | `sundai-v3-email-events` | `sundai-v3-ses-events` | `https://v3.sundai.club/api/webhooks/ses` |

Both sets publish Delivery, Bounce, Complaint, Reject, and Rendering Failure
events. Vercel has `AWS_SES_CONFIGURATION_SET` and `AWS_SES_EVENTS_TOPIC_ARN`
for each environment. Subscribe the topic after the webhook is deployed:

```bash
aws sns subscribe --region us-east-2 --protocol https \
  --topic-arn <topic ARN> --notification-endpoint <webhook>
```

The webhook confirms the subscription, verifies each SNS signature, and rejects
other topics. Each email has the SES tag `sundai_recipient` with its recipient
row ID, so events match even when SES reports delivery before the worker saves
the message ID.

| SES event | Result |
| --- | --- |
| Delivery | `DELIVERED` unless the message already failed |
| Bounce | `UNDELIVERED`, code `Bounce.<type>.<subtype>` |
| Complaint | Sets `complainedAt` and turns off chapter email for that person |
| Reject, Rendering Failure | `FAILED` |

A hard bounce (`Bounce.Permanent.*`) means the address can never receive mail,
for example because it does not exist. The SES account suppression list already
blocks later sends to hard-bounced and complaining addresses. A soft bounce
(`Bounce.Transient.*`) is temporary, such as a full mailbox.

`/admin/communications` shows the hard bounce and complaint rates for the last
30 days. SES reviews the account at 5% bounces or 0.1% complaints. The page
warns at 2% and 0.08%.

## Unsubscribe

Each event or weekly email has RFC 8058 headers:

```text
List-Unsubscribe: <https://www.sundai.club/api/email/unsubscribe/<kind>-<recipientId>>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

A POST to that URL turns off chapter email for the event's chapter. For the
weekly email it turns off email for all of that person's chapters. A GET never
unsubscribes, because link scanners send GET requests. It opens the chapter
notification preferences instead.

## Link clicks and RSVPs

When an email is queued, each distinct `http(s)` link becomes a `MessageLink`
row, and its `href` becomes `/l/<linkId>?r=<recipientId>`. SMS URLs become
per-recipient short links, `/s/<code>`. Both routes save the click and return a
302 to the stored URL. They do not accept a destination from the request.

Unsubscribe and preference links are tracked as `PREFERENCES` and excluded from
the click rate. A link to `/events/<chapter>/<event>` stores the event ID. A
person who clicks it and then registers for that event counts as an RSVP.

Clicks are saved as bot clicks and excluded from results when:

- the user agent is missing, a known mail scanner, a link preview (including
  iMessage, which uses `facebookexternalhit`), or a script;
- an email link is opened within 10 seconds of sending;
- the same recipient opens another link within 2 seconds (both are excluded);
- the request is a HEAD request (not saved).

## Failure diagnosis

Failures are grouped by provider code, with a plain-language reason, a hint,
and one example provider message with email addresses and phone numbers
removed. Twilio send errors save only the numeric Twilio code, because Twilio
messages can contain credentials. Sends before this change saved
`PROVIDER_ERROR` with no code. Check Twilio Console > Monitor > Logs > Errors
for those.

SMS sends run with at most 10 concurrent Twilio requests. A Twilio rate-limit
response (20429) is retried up to three times. Twilio did not accept those
messages, so a retry cannot send a duplicate.
