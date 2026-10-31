import { createHash, randomBytes } from 'crypto';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { sendEventEmail } from '@/lib/eventDelivery';
import { JUDGE_TOKEN_PARAM } from '@/types/judging';

// Judges usually have no account, so each invite carries a personal token in
// its URL. Nothing is stored in the browser: the judging tab appears only for
// a URL with a valid token, or for a signed-in account that was invited.

export function createJudgeToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashJudgeToken(token) };
}

export function hashJudgeToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeJudgeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidJudgeEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Links open the event's judging tab on the site the organizer invited from,
 * so local, preview, and production invites each reach the right deployment.
 */
export function judgeMagicLink(
  token: string,
  origin: string,
  event: { slug: string; chapterSlug: string }
) {
  const url = new URL(
    `/events/${encodeURIComponent(event.chapterSlug)}/${encodeURIComponent(event.slug)}`,
    origin
  );
  url.searchParams.set('tab', 'judging');
  url.searchParams.set(JUDGE_TOKEN_PARAM, token);
  return url.toString();
}

export type ResolvedEventJudge = {
  id: string;
  email: string;
  name: string | null;
};

/**
 * Resolves the viewer's judge record from a magic-link token, falling back to
 * the signed-in account (matched by account or by invited email).
 */
export async function resolveEventJudge(
  eventId: string,
  token: string | null | undefined
): Promise<ResolvedEventJudge | null> {
  const select = { id: true, email: true, name: true, hackerId: true };
  if (token) {
    const judge = await prisma.eventJudge.findFirst({
      where: { eventId, tokenHash: hashJudgeToken(token), revokedAt: null },
      select,
    });
    if (judge) return judge;
  }

  const { userId } = await auth();
  if (!userId) return null;
  const hacker = await prisma.hacker.findUnique({
    where: { clerkId: userId },
    select: { id: true, email: true },
  });
  if (!hacker) return null;

  const judge = await prisma.eventJudge.findFirst({
    where: {
      eventId,
      revokedAt: null,
      OR: [
        { hackerId: hacker.id },
        ...(hacker.email
          ? [{ email: normalizeJudgeEmail(hacker.email), hackerId: null }]
          : []),
      ],
    },
    select,
  });
  if (judge && !judge.hackerId) {
    await prisma.eventJudge.update({
      where: { id: judge.id },
      data: { hackerId: hacker.id },
    });
  }
  return judge;
}

/**
 * Returns the judging event when the viewer is one of its judges. Judges may
 * open the judging tab even when they couldn't otherwise see the event.
 */
export async function findViewerJudgedEvent(
  chapterSlug: string,
  eventSlug: string,
  token: string | null | undefined
) {
  const event = await prisma.event.findFirst({
    where: {
      slug: eventSlug,
      chapter: { slug: chapterSlug },
      judgingEnabled: true,
    },
    select: { id: true, title: true, chapter: { select: { name: true } } },
  });
  if (!event || !(await resolveEventJudge(event.id, token))) return null;
  return event;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildJudgeInviteEmail(input: {
  judgeName: string | null;
  eventTitle: string;
  chapterName: string;
  trackNames: string[];
  link: string;
}) {
  const greeting = input.judgeName ? `Hi ${input.judgeName},` : 'Hi,';
  const tracks = input.trackNames.length
    ? `You'll be judging: ${input.trackNames.join(', ')}.`
    : '';
  const paragraphs = [
    greeting,
    `${input.chapterName} invited you to judge projects at ${input.eventTitle}.`,
    tracks,
    'Use the button below to open your judging page. No account is needed. This link is personal to you, so please do not forward it.',
  ].filter(Boolean);
  const subject = `You're invited to judge ${input.eventTitle}`;
  const body = `${paragraphs.join('\n\n')}\n\nStart judging: ${input.link}`;
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:#08090d">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#08090d">
    <tr>
      <td align="center" style="padding:32px 12px">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background-color:#151c3f;border:1px solid #30385f">
          <tr><td style="height:8px;background-color:#e268a9;background-image:linear-gradient(90deg,#8fa7df,#e268a9,#f7b44f)"></td></tr>
          <tr>
            <td style="padding:36px 36px 40px">
              <p style="margin:0 0 14px;font-family:'Courier New',Courier,monospace;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#f7b44f">// Judge invitation · ${escapeHtml(input.chapterName)}</p>
              <h1 style="margin:0 0 24px;color:#ffffff;font-family:'Courier New',Courier,monospace;font-size:32px;line-height:1.2">${escapeHtml(input.eventTitle)}</h1>
              ${paragraphs
                .map(
                  paragraph =>
                    `<p style="margin:0 0 16px;color:#e5e7eb;font-family:'Courier New',Courier,monospace;font-size:16px;line-height:1.7">${escapeHtml(paragraph)}</p>`
                )
                .join('')}
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px">
                <tr>
                  <td align="center" bgcolor="#f7b44f">
                    <a href="${escapeHtml(input.link)}" style="display:inline-block;padding:15px 24px;color:#151c3f;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;text-decoration:none">START JUDGING →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, body, html };
}

export type JudgeInviteDelivery = {
  sent: boolean;
  message: string | null;
  /** Only outside production, so invites can be tested without email delivery. */
  devLink: string | null;
};

/**
 * Issues a fresh magic link and emails it. Rotating the token on every send
 * means only the newest email works, so a resend also recovers a leaked link.
 */
export async function sendJudgeInvite(
  judgeId: string,
  origin: string,
  send: typeof sendEventEmail = sendEventEmail
): Promise<JudgeInviteDelivery> {
  const { token, tokenHash } = createJudgeToken();
  const judge = await prisma.eventJudge.update({
    where: { id: judgeId },
    data: { tokenHash, lastSentAt: new Date() },
    select: {
      email: true,
      name: true,
      event: {
        select: {
          title: true,
          slug: true,
          chapter: { select: { name: true, slug: true } },
        },
      },
      tracks: {
        select: { track: { select: { name: true, position: true } } },
      },
    },
  });
  const link = judgeMagicLink(token, origin, {
    slug: judge.event.slug,
    chapterSlug: judge.event.chapter.slug,
  });
  const email = buildJudgeInviteEmail({
    judgeName: judge.name,
    eventTitle: judge.event.title,
    chapterName: judge.event.chapter.name,
    trackNames: judge.tracks
      .map(({ track }) => track)
      .sort((a, b) => a.position - b.position)
      .map(track => track.name),
    link,
  });
  const result = await send({ to: judge.email, ...email });
  const sent = result.status === 'SENT';
  return {
    sent,
    message: sent
      ? null
      : (result.errorMessage ?? 'The invite email could not be sent.'),
    devLink: !sent && process.env.NODE_ENV !== 'production' ? link : null,
  };
}
