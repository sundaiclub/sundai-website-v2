import {
  getViewerRegistrationState,
  redactPublicEventForViewer,
} from '../../src/lib/publicEvents';

const sensitiveValues = {
  notes: 'PRIVATE ORGANIZER NOTE SENTINEL',
  storageKey: 'events/private/material-object-key.pdf',
  contactSnapshot: 'private-attendee@example.com',
  providerError: 'SES PROVIDER CREDENTIAL ERROR SENTINEL',
  internalReviewReason: 'PRIVATE INTERNAL REVIEW REASON SENTINEL',
  moderationData: 'PRIVATE MODERATION BAN SENTINEL',
};

function eventRecordWithOrganizerData() {
  return {
    id: 'event-redaction',
    slug: 'redaction-night',
    title: 'Redaction Night',
    description: 'Public event description.',
    startTime: new Date('2026-08-01T18:00:00.000Z'),
    endTime: new Date('2026-08-01T22:00:00.000Z'),
    publicLocation: 'Public venue',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    capacity: 100,
    applicationMode: 'REQUIRES_APPROVAL',
    applicationsOpen: true,
    applicationsClosedAt: null,
    applicationsCloseReason: null,
    autoPromoteWaitlist: true,
    approvedDetailsJson: null,
    applicationQuestionsJson: [],
    hideChapterDefaultQuestions: false,
    chapterId: 'chapter-redaction',
    chapter: {
      id: 'chapter-redaction',
      slug: 'redaction',
      name: 'Redaction Chapter',
      timezone: 'America/New_York',
    },
    _count: { registrations: 1 },
    organizerNote: { body: sensitiveValues.notes },
    materials: [{ storageKey: sensitiveValues.storageKey }],
    communications: [
      {
        contactSnapshot: { email: sensitiveValues.contactSnapshot },
        providerError: sensitiveValues.providerError,
      },
    ],
    registrations: [
      {
        internalReviewNotes: sensitiveValues.internalReviewReason,
        activeBan: { reason: sensitiveValues.moderationData },
      },
    ],
  } as unknown as Parameters<typeof redactPublicEventForViewer>[0];
}

function expectNoOrganizerData(serialized: string) {
  for (const value of Object.values(sensitiveValues)) {
    expect(serialized).not.toContain(value);
  }
  expect(serialized).not.toMatch(
    /organizerNote|storageKey|contactSnapshot|providerError|internalReview|activeBan|moderation/i
  );
}

describe('public and attendee workspace serialization boundaries', () => {
  it('does not serialize organizer-only cross-story data to signed-out public viewers', () => {
    const response = redactPublicEventForViewer(
      eventRecordWithOrganizerData(),
      {
        viewerIsSignedIn: false,
        now: new Date('2026-07-01T12:00:00.000Z'),
      }
    );

    expectNoOrganizerData(JSON.stringify(response));
  });

  it('does not serialize organizer-only cross-story data to approved attendees', async () => {
    const registrationRecord = {
      eventId: 'event-redaction',
      hackerId: 'hacker-attendee',
      id: 'registration-redaction',
      status: 'APPROVED',
      submittedAt: new Date('2026-07-01T12:00:00.000Z'),
      cancelledAt: null,
      publicSafeMessage: null,
      canEditAnswers: false,
      canCancel: true,
      answersJson: { dietaryNeeds: 'vegetarian' },
      organizerNote: { body: sensitiveValues.notes },
      storageKey: sensitiveValues.storageKey,
      contactSnapshot: { email: sensitiveValues.contactSnapshot },
      providerError: sensitiveValues.providerError,
      internalReviewNotes: sensitiveValues.internalReviewReason,
      moderation: { reason: sensitiveValues.moderationData },
    };
    const attendeeClient = {
      eventRegistration: {
        findFirst: jest.fn().mockResolvedValue(registrationRecord),
      },
    } as unknown as Parameters<typeof getViewerRegistrationState>[2];
    const viewerRegistration = await getViewerRegistrationState(
      'event-redaction',
      'hacker-attendee',
      attendeeClient
    );

    const response = redactPublicEventForViewer(
      eventRecordWithOrganizerData(),
      {
        viewerRegistration,
        viewerIsSignedIn: true,
        now: new Date('2026-07-01T12:00:00.000Z'),
      }
    );

    expectNoOrganizerData(JSON.stringify(response));
  });
});
