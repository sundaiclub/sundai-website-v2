import { publicUrl } from '@/lib/siteUrl';

export type ChapterEventInvitationContext = {
  title: string;
  slug: string;
  startTime: Date | string;
  timezone: string;
  venueName?: string | null;
  location?: string | null;
  publicLocation?: string | null;
  chapter: { name: string; slug: string };
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function invitationUrls(event: ChapterEventInvitationContext) {
  const chapterSlug = encodeURIComponent(event.chapter.slug);
  return {
    eventUrl: publicUrl(
      `/events/${chapterSlug}/${encodeURIComponent(event.slug)}`
    ),
    preferencesUrl: publicUrl(
      `/chapters/${chapterSlug}?tab=preferences#notification-preferences`
    ),
  };
}

function formattedStart(event: ChapterEventInvitationContext): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: event.timezone,
  }).format(new Date(event.startTime));
}

export function chapterEventInvitationDefaults(
  event: ChapterEventInvitationContext
) {
  const when = formattedStart(event);
  const location = event.venueName ?? event.publicLocation ?? event.location;
  const eventDetails = `Time: ${when}\nLocation: ${location ?? 'To be announced'}`;
  return {
    subject: `You're invited to ${event.title}`,
    emailBody: `Join ${event.chapter.name} for ${event.title}.\n\n${eventDetails}`,
    smsBody: `${event.chapter.name}: You're invited to ${event.title}. Time: ${when}. Location: ${location ?? 'To be announced'}.`,
  };
}

export function chapterEventInvitationDelivery(
  event: ChapterEventInvitationContext,
  body: string
) {
  const { eventUrl, preferencesUrl } = invitationUrls(event);
  const brandImageUrl = publicUrl('/images/sundai-social-card.png');
  const text = `${body.trim()}\n\nView event and RSVP: ${eventUrl}\n\nManage chapter notification preferences or unsubscribe: ${preferencesUrl}`;
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map(
      paragraph =>
        `<p style="margin:0 0 18px;color:#e5e7eb;font-family:'Courier New',Courier,monospace;font-size:16px;line-height:1.7">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`
    )
    .join('');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(event.title)}</title>
  <style>
    @media only screen and (max-width: 640px) {
      .email-shell { width: 100% !important; }
      .email-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .event-title { font-size: 30px !important; }
      .hero-image { height: auto !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#08090d;color:#ffffff">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(event.chapter.name)} invited you to ${escapeHtml(event.title)}.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#08090d">
    <tr>
      <td align="center" style="padding:0 12px 40px">
        <table role="presentation" class="email-shell" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:640px">
          <tr>
            <td style="height:8px;background-color:#8fa7df"></td>
            <td style="height:8px;background-color:#b48bca"></td>
            <td style="height:8px;background-color:#e268a9"></td>
            <td style="height:8px;background-color:#f58b76"></td>
            <td style="height:8px;background-color:#f7b44f"></td>
          </tr>
          <tr>
            <td colspan="5" class="email-padding" style="padding:26px 32px 22px;background-color:#08090d">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:700;letter-spacing:2px;color:#ffffff">SUNDAI CLUB</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td colspan="5" style="background-color:#000000;border:1px solid #25283a;border-bottom:0">
              <img class="hero-image" src="${escapeHtml(brandImageUrl)}" width="638" alt="Sundai Club" style="display:block;width:100%;max-width:638px;height:auto;border:0">
            </td>
          </tr>
          <tr>
            <td colspan="5" class="email-padding" style="padding:38px 42px 42px;background-color:#151c3f;border:1px solid #30385f;border-top:0">
              <p style="margin:0 0 14px;font-family:'Courier New',Courier,monospace;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#f7b44f">// Event invitation · ${escapeHtml(event.chapter.name)}</p>
              <h1 class="event-title" style="margin:0 0 26px;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:40px;line-height:1.15;letter-spacing:-1px">${escapeHtml(event.title)}</h1>
              <div style="height:2px;margin:0 0 26px;background-color:#e268a9;background-image:linear-gradient(90deg,#8fa7df,#e268a9,#f7b44f)"></div>
              ${paragraphs}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px">
                <tr>
                  <td align="center" bgcolor="#f7b44f" style="border:2px solid #08090d">
                    <a href="${escapeHtml(eventUrl)}" style="display:inline-block;padding:15px 24px;color:#151c3f;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;letter-spacing:.5px;text-decoration:none">VIEW EVENT + RSVP →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td colspan="5" class="email-padding" style="padding:24px 32px;background-color:#0e1020;border:1px solid #25283a;border-top:0">
              <p style="margin:0 0 10px;color:#9ca3af;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.7">You received this email because you enabled email notifications for ${escapeHtml(event.chapter.name)}.</p>
              <p style="margin:0;color:#9ca3af;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.7"><a href="${escapeHtml(preferencesUrl)}" style="color:#f7b44f;text-decoration:underline">Manage notification preferences or unsubscribe</a></p>
            </td>
          </tr>
          <tr>
            <td colspan="5" align="center" style="padding:24px 16px;color:#6b7280;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:1px">${escapeHtml(event.chapter.name.toUpperCase())} · COMMUNITY BUILDS TOGETHER</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return {
    text,
    html,
    sms: `${body.trim()} ${eventUrl} Unsubscribe: ${preferencesUrl}`,
  };
}
