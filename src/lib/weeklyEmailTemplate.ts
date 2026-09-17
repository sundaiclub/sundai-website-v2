import MarkdownIt from 'markdown-it';
import { normalizeProjectMarkdown } from '@/lib/markdown';
import { publicUrl } from '@/lib/siteUrl';
import type { WeeklyEmailContent } from '@/lib/weeklyEmails';

export function renderWeeklyEmail(
  draft: { subject: string; body: string },
  recipient: WeeklyEmailContent['recipients'][number],
  projects: WeeklyEmailContent['projects']
) {
  const greeting = `Hi ${recipient.name.trim().split(/\s+/)[0] || 'there'},`;
  const chapters = recipient.chapterMemberships.map(({ chapter }) => chapter);
  const upcoming = chapters.flatMap(chapter =>
    chapter.events.map(event => ({
      chapter,
      event,
      url: publicUrl(
        `/events/${encodeURIComponent(chapter.slug)}/${encodeURIComponent(event.slug)}`
      ),
      date:
        new Intl.DateTimeFormat('en-US', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: event.timezone,
        }).format(event.startTime) + ` (${event.timezone})`,
      status: !event.applicationsOpen
        ? 'Registration closed'
        : event.capacity !== null &&
            event._count.registrations >= event.capacity
          ? 'At capacity — check event for waitlist options'
          : 'Registration open',
    }))
  );
  const projectUrl = (id: string) =>
    publicUrl(`/projects/${encodeURIComponent(id)}`);
  const preferencesUrl = (slug: string) =>
    publicUrl(`/chapters/${encodeURIComponent(slug)}#notification-preferences`);
  const body = [
    greeting,
    draft.body,
    ...(upcoming.length
      ? [
          'Your next events',
          ...upcoming.map(
            ({ chapter, event, url, date, status }) =>
              `${chapter.name}: ${event.title}\n${date}\n${event.publicLocation || ''}\n${status}\n${url}`
          ),
        ]
      : []),
    ...(projects.length
      ? [
          'Top projects this week',
          ...projects.map(
            project =>
              `${project.title} — ${project._count.likes} likes this week\n${project.preview || ''}\n${projectUrl(project.id)}`
          ),
        ]
      : []),
    'Sundai',
    'Manage chapter email preferences:',
    ...chapters.map(
      chapter => `${chapter.name}: ${preferencesUrl(chapter.slug)}`
    ),
  ].join('\n\n');

  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      char =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char]!
    );
  const link = (url: string, label: string) =>
    '<a style="color:#8fa7df;text-decoration:underline" href="' +
    escape(url) +
    '">' +
    escape(label) +
    '</a>';
  const section = (content: string) =>
    '<div style="border-bottom:1px solid #30385f;padding:24px 0">' +
    content +
    '</div>';
  const cardImage = (
    image: { url: string; alt: string | null } | null | undefined,
    title: string,
    defaultPath: string
  ) => {
    let src = publicUrl(defaultPath);
    try {
      const candidate = new URL(
        image?.url?.trim() || defaultPath,
        publicUrl('/')
      );
      if (candidate.protocol === 'https:' || candidate.protocol === 'http:') {
        src = candidate.href;
      }
    } catch {
      // Invalid image URLs use the same default as a missing image.
    }
    return (
      '<img src="' +
      escape(src) +
      '" alt="' +
      escape(image?.alt || title) +
      '" width="576" style="display:block;width:100%;max-width:576px;height:auto;border:0;margin:12px 0">'
    );
  };
  const divider = (title: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:40px;border-top:1px solid #596184"><tr><td style="padding:24px 0 0"><h2 style="margin:0;font-family:'Courier New',Courier,monospace;font-size:26px;line-height:1.3;color:#ffffff">${escape(title)}</h2></td></tr></table>`;
  const button = (url: string, label: string) =>
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px"><tr><td align="center" bgcolor="#f7b44f" style="border:2px solid #08090d"><a href="${escape(url)}" style="display:inline-block;padding:15px 24px;color:#151c3f;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:700;letter-spacing:.5px;text-decoration:none">${escape(label)}</a></td></tr></table>`;
  const eventsHtml = upcoming.length
    ? divider('Your next events') +
      chapters
        .map(chapter => {
          const events = upcoming.filter(
            item => item.chapter.id === chapter.id
          );
          if (!events.length) return '';
          return (
            `<div style="margin-top:28px;padding:0 0 12px;border-bottom:2px solid #b48bca">
          <p style="margin:0 0 6px;color:#9ca3af;font-size:11px;letter-spacing:2px;text-transform:uppercase">Chapter</p>
          <h3 style="margin:0;color:#b48bca;font-size:24px;line-height:1.3">${escape(chapter.name)}</h3>
        </div>` +
            events
              .map(({ event, url, date, status }) =>
                section(
                  `<h4 style="margin:0 0 18px;font-size:22px;line-height:1.3">${link(url, event.title)}</h4>
          ${cardImage(event.image, event.title, '/images/default_event_email.png')}
          <p style="margin:18px 0 12px;color:#e5e7eb">${escape(date)}</p>
          ${event.publicLocation ? '<p style="margin:0 0 12px;color:#e5e7eb">' + escape(event.publicLocation) + '</p>' : ''}
          <p style="margin:0;color:#9ca3af;font-size:14px">${escape(status)}</p>
          ${button(url, 'VIEW EVENT →')}`
                )
              )
              .join('')
          );
        })
        .join('')
    : '';
  const projectsHtml = projects.length
    ? divider('Top projects this week') +
      projects
        .map(project =>
          section(
            `<h3 style="margin:0 0 18px;font-size:24px;line-height:1.3">${link(projectUrl(project.id), project.title)}</h3>
    ${cardImage(project.thumbnail, project.title, '/images/default_project_thumbnail_email.png')}
    ${project.preview ? renderEmailMarkdown(project.preview) : ''}
    <p style="margin:12px 0;color:#9ca3af;font-size:14px">${project._count.likes} likes this week</p>
    ${button(projectUrl(project.id), 'VIEW PROJECT →')}`
          )
        )
        .join('')
    : '';
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>${escape(draft.subject)}</title>
  <style>
    @media only screen and (max-width:640px) {
      .email-shell { width:100% !important; }
      .email-padding { padding-left:20px !important; padding-right:20px !important; }
      .email-title { font-size:30px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#08090d;color:#ffffff">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your weekly community update from Sundai Club.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#08090d">
    <tr><td align="center" style="padding:0 12px 40px">
      <table role="presentation" class="email-shell" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:640px">
        <tr>
          <td style="height:8px;background-color:#8fa7df"></td>
          <td style="height:8px;background-color:#b48bca"></td>
          <td style="height:8px;background-color:#e268a9"></td>
          <td style="height:8px;background-color:#f58b76"></td>
          <td style="height:8px;background-color:#f7b44f"></td>
        </tr>
        <tr><td colspan="5" class="email-padding" style="padding:26px 32px 22px;background-color:#08090d">
          <a href="${escape(publicUrl('/'))}" style="font-family:'Courier New',Courier,monospace;font-size:18px;font-weight:700;letter-spacing:2px;color:#ffffff;text-decoration:none">Sundai Club</a>
        </td></tr>
        <tr><td colspan="5" style="background-color:#000000;border:1px solid #25283a;border-bottom:0">
          <img src="${escape(publicUrl('/images/sundai-social-card.png'))}" width="638" alt="Sundai Club" style="display:block;width:100%;max-width:638px;height:auto;border:0">
        </td></tr>
        <tr><td colspan="5" class="email-padding" style="padding:38px 42px 42px;background-color:#151c3f;border:1px solid #30385f;border-top:0;font-family:'Courier New',Courier,monospace;font-size:16px;line-height:1.7;color:#e5e7eb">
          <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#f7b44f">// Your weekly community update</p>
          <h1 class="email-title" style="margin:0 0 26px;color:#ffffff;font-size:40px;line-height:1.15;letter-spacing:-1px">${escape(draft.subject)}</h1>
          <div style="height:2px;margin:0 0 26px;background-color:#e268a9;background-image:linear-gradient(90deg,#8fa7df,#e268a9,#f7b44f)"></div>
          <p style="margin:0 0 18px">${escape(greeting)}</p>
          ${renderEmailMarkdown(draft.body)}
          ${eventsHtml}
          ${projectsHtml}
        </td></tr>
        <tr><td colspan="5" class="email-padding" style="padding:24px 32px;background-color:#0e1020;border:1px solid #25283a;border-top:0;font-family:'Courier New',Courier,monospace;font-size:11px;line-height:1.7;color:#9ca3af">
          <p style="margin:0 0 10px">You received this email because you enabled chapter email notifications. Manage your preferences or unsubscribe:</p>
          ${chapters.map(chapter => '<p style="margin:0 0 8px">' + link(preferencesUrl(chapter.slug), chapter.name) + '</p>').join('')}
        </td></tr>
        <tr><td colspan="5" align="center" style="padding:24px 16px;color:#6b7280;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:1px">SUNDAI CLUB · COMMUNITY BUILDS TOGETHER</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { body, html };
}

// HTML is disabled. MarkdownIt's URL checks block executable link schemes.
const markdown = new MarkdownIt({ html: false });
const defaultImage = markdown.renderer.rules.image!;
markdown.renderer.rules.image = (tokens, index, options, env, self) => {
  tokens[index].attrSet('style', 'max-width:100%;height:auto');
  return defaultImage(tokens, index, options, env, self);
};
markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
  tokens[index].attrSet('style', 'color:#f7b44f;text-decoration:underline');
  return self.renderToken(tokens, index, options);
};
export function renderEmailMarkdown(value: string) {
  return markdown.render(normalizeProjectMarkdown(value));
}
