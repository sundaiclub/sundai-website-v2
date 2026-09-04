import {
  chapterEventInvitationDefaults,
  chapterEventInvitationDelivery,
} from '../../src/lib/chapterEventInvitations';

const event = {
  title: 'AI <Build> Night',
  slug: 'ai-build-night',
  startTime: new Date('2026-09-05T22:00:00.000Z'),
  timezone: 'America/New_York',
  venueName: 'Build Lab',
  chapter: { name: 'Sundai & Boston', slug: 'boston' },
};

describe('chapter event invitation content', () => {
  it('builds useful default email and SMS copy from event details', () => {
    const defaults = chapterEventInvitationDefaults(event);

    expect(defaults).toMatchObject({
      subject: "You're invited to AI <Build> Night",
      emailBody: expect.stringContaining('Build Lab'),
      smsBody: expect.stringContaining('AI <Build> Night'),
    });
    expect(defaults.emailBody).toContain('Time: Saturday, September 5, 2026');
    expect(defaults.emailBody).toContain('Location: Build Lab');
    expect(defaults.smsBody).toContain('Time: Saturday, September 5, 2026');
    expect(defaults.smsBody).toContain('Location: Build Lab');
    expect(defaults.smsBody).toMatch(
      /AI <Build> Night\.\n\nTime:.*\n\nLocation: Build Lab/
    );
  });

  it('identifies an event location that is not announced', () => {
    const defaults = chapterEventInvitationDefaults({
      ...event,
      venueName: null,
    });

    expect(defaults.emailBody).toContain('Location: To be announced');
    expect(defaults.smsBody).toContain('Location: To be announced');
  });

  it('formats email HTML with safe event and unsubscribe links', () => {
    const result = chapterEventInvitationDelivery(
      event,
      'Join us. <script>alert(1)</script>'
    );

    expect(result.text).toContain(
      '/chapters/boston?tab=preferences#notification-preferences'
    );
    expect(result.html).toMatch(/view event \+ rsvp/i);
    expect(result.html).toContain(
      'Manage notification preferences or unsubscribe'
    );
    expect(result.html).toContain('AI &lt;Build&gt; Night');
    expect(result.html).toContain('/images/sundai-social-card.png');
    expect(result.html).toContain('SUNDAI CLUB');
    expect(result.html).not.toMatch(/hacker club/i);
    expect(result.html).not.toMatch(/build\. share\. repeat\./i);
    expect(result.html).toContain('#151c3f');
    expect(result.html).toContain('#f7b44f');
    expect(result.html).toContain('VIEW EVENT + RSVP');
    expect(result.html).not.toContain('<script>');
    expect(result.sms).toContain('/events/boston/ai-build-night');
    expect(result.sms).toContain('\n\nView event:');
    expect(result.sms).toContain('\n\nUnsubscribe:');
    expect(result.sms).toContain('Unsubscribe:');
    expect(result.sms).toContain(
      '/chapters/boston?tab=preferences#notification-preferences'
    );
    expect(result.sms).not.toMatch(/hacker club|build\. share\. repeat\./i);
  });
});
