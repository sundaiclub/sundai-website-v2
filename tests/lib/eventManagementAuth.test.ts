import {
  canAccessEventWorkspaceWithContext,
  canAdministerEventWithContext,
  canDecideEventRegistrationWithContext,
  canDecideEventApplicantsWithContext,
  canDecideRegistrationsWithContext,
  canEditRegistrationNotesWithContext,
  canEditOrganizerNoteWithContext,
  canIncludeBannedUsersInReviewWithContext,
  canManageChapterSettingsWithContext,
  canManageEventSettingsWithContext,
  canManageEventCommunicationsWithContext,
  canManageEventMaterialsWithContext,
  canManageEventNotesWithContext,
  canManageEventOperationsWithContext,
  canManageEventPitchWithContext,
  canManagePitchWithContext,
  canManageRegistrationsWithContext,
  canPublishEventWithContext,
  canReviewRegistrationsWithContext,
  canViewBannedUserReviewContextWithContext,
  canViewChapterWithContext,
  canViewOrganizerNoteRevisionsWithContext,
  canViewOrganizerNoteWithContext,
  getEventStaffForPermissions,
  hasChapterOrganizerNoteRelevance,
  hasEventRegistrationForPermissions,
  isCoMcNoteOnlyRegistrationReviewerWithContext,
  type ChapterPermissionContext,
  type EventPermissionContext,
  type OrganizerNotePermissionContext,
} from '../../src/lib/eventManagementAuth';
import {
  buildChapter,
  buildChapterAdminFixture,
  buildChapterMemberFixture,
  buildCoMcFixture,
  buildEventStaffFixture,
  buildHacker,
  buildSiteAdmin,
  type ChapterMembershipFixture,
  type EventStaffFixture,
  type HackerFixture,
} from '../utils/event-management-fixtures';

const actorContext = (
  hacker: Pick<HackerFixture, 'role'> | null
): ChapterPermissionContext['actor'] => (hacker ? { role: hacker.role } : null);

const chapterMembershipContext = (
  membership: Pick<ChapterMembershipFixture, 'role' | 'status'> | null
): ChapterPermissionContext['membership'] =>
  membership
    ? {
        role: membership.role,
        status: membership.status,
      }
    : null;

const staffContext = (
  staff: Pick<EventStaffFixture, 'role'> | null
): EventPermissionContext['staff'] => (staff ? { role: staff.role } : null);

describe('event management permission contexts', () => {
  const siteAdmin = buildSiteAdmin();
  const chapterAdmin = buildChapterAdminFixture();
  const chapterMember = buildChapterMemberFixture();
  const mc = buildEventStaffFixture();
  const coMc = buildCoMcFixture();
  const regularUser = buildHacker({
    id: 'hacker-regular',
    clerkId: 'clerk-regular',
    name: 'Regular User',
    username: 'regularuser',
    email: 'regular@example.com',
  });

  const permissionCases: Array<{
    label: string;
    chapterContext: Omit<ChapterPermissionContext, 'chapter'>;
    eventContext: EventPermissionContext;
    organizerContext: OrganizerNotePermissionContext;
    expected: {
      canViewPublicChapter: boolean;
      canViewPrivateChapter: boolean;
      canManageChapterSettings: boolean;
      canManageEventSettings: boolean;
      canManagePitch: boolean;
      canManageRegistrations: boolean;
      canDecideRegistrations: boolean;
      canViewRelevantNote: boolean;
      canEditRelevantNote: boolean;
      canViewRelevantNoteRevisions: boolean;
    };
  }> = [
    {
      label: 'site admin',
      chapterContext: {
        actor: actorContext(siteAdmin),
        membership: null,
      },
      eventContext: {
        actor: actorContext(siteAdmin),
        chapterMembership: null,
        staff: null,
      },
      organizerContext: {
        actor: actorContext(siteAdmin),
        chapterMembership: null,
        staff: null,
        targetIsRelevantToChapter: true,
        targetIsRelevantToEvent: true,
      },
      expected: {
        canViewPublicChapter: true,
        canViewPrivateChapter: true,
        canManageChapterSettings: true,
        canManageEventSettings: true,
        canManagePitch: true,
        canManageRegistrations: true,
        canDecideRegistrations: true,
        canViewRelevantNote: true,
        canEditRelevantNote: true,
        canViewRelevantNoteRevisions: true,
      },
    },
    {
      label: 'chapter admin',
      chapterContext: {
        actor: actorContext(chapterAdmin.hacker),
        membership: chapterMembershipContext(chapterAdmin.membership),
      },
      eventContext: {
        actor: actorContext(chapterAdmin.hacker),
        chapterMembership: chapterMembershipContext(chapterAdmin.membership),
        staff: null,
      },
      organizerContext: {
        actor: actorContext(chapterAdmin.hacker),
        chapterMembership: chapterMembershipContext(chapterAdmin.membership),
        staff: null,
        targetIsRelevantToChapter: true,
        targetIsRelevantToEvent: true,
      },
      expected: {
        canViewPublicChapter: true,
        canViewPrivateChapter: true,
        canManageChapterSettings: true,
        canManageEventSettings: true,
        canManagePitch: true,
        canManageRegistrations: true,
        canDecideRegistrations: true,
        canViewRelevantNote: true,
        canEditRelevantNote: true,
        canViewRelevantNoteRevisions: true,
      },
    },
    {
      label: 'chapter member',
      chapterContext: {
        actor: actorContext(chapterMember.hacker),
        membership: chapterMembershipContext(chapterMember.membership),
      },
      eventContext: {
        actor: actorContext(chapterMember.hacker),
        chapterMembership: chapterMembershipContext(chapterMember.membership),
        staff: null,
      },
      organizerContext: {
        actor: actorContext(chapterMember.hacker),
        chapterMembership: chapterMembershipContext(chapterMember.membership),
        staff: null,
        targetIsRelevantToChapter: true,
        targetIsRelevantToEvent: true,
      },
      expected: {
        canViewPublicChapter: true,
        canViewPrivateChapter: true,
        canManageChapterSettings: false,
        canManageEventSettings: false,
        canManagePitch: false,
        canManageRegistrations: false,
        canDecideRegistrations: false,
        canViewRelevantNote: false,
        canEditRelevantNote: false,
        canViewRelevantNoteRevisions: false,
      },
    },
    {
      label: 'event MC',
      chapterContext: {
        actor: actorContext(mc.hacker),
        membership: null,
      },
      eventContext: {
        actor: actorContext(mc.hacker),
        chapterMembership: null,
        staff: staffContext(mc.staff),
      },
      organizerContext: {
        actor: actorContext(mc.hacker),
        chapterMembership: null,
        staff: staffContext(mc.staff),
        targetIsRelevantToChapter: false,
        targetIsRelevantToEvent: true,
      },
      expected: {
        canViewPublicChapter: true,
        canViewPrivateChapter: false,
        canManageChapterSettings: false,
        canManageEventSettings: false,
        canManagePitch: true,
        canManageRegistrations: true,
        canDecideRegistrations: true,
        canViewRelevantNote: true,
        canEditRelevantNote: true,
        canViewRelevantNoteRevisions: false,
      },
    },
    {
      label: 'event co-MC',
      chapterContext: {
        actor: actorContext(coMc.hacker),
        membership: null,
      },
      eventContext: {
        actor: actorContext(coMc.hacker),
        chapterMembership: null,
        staff: staffContext(coMc.staff),
      },
      organizerContext: {
        actor: actorContext(coMc.hacker),
        chapterMembership: null,
        staff: staffContext(coMc.staff),
        targetIsRelevantToChapter: false,
        targetIsRelevantToEvent: true,
      },
      expected: {
        canViewPublicChapter: true,
        canViewPrivateChapter: false,
        canManageChapterSettings: false,
        canManageEventSettings: false,
        canManagePitch: true,
        canManageRegistrations: true,
        canDecideRegistrations: false,
        canViewRelevantNote: true,
        canEditRelevantNote: true,
        canViewRelevantNoteRevisions: false,
      },
    },
    {
      label: 'regular user',
      chapterContext: {
        actor: actorContext(regularUser),
        membership: null,
      },
      eventContext: {
        actor: actorContext(regularUser),
        chapterMembership: null,
        staff: null,
      },
      organizerContext: {
        actor: actorContext(regularUser),
        chapterMembership: null,
        staff: null,
        targetIsRelevantToChapter: true,
        targetIsRelevantToEvent: true,
      },
      expected: {
        canViewPublicChapter: true,
        canViewPrivateChapter: false,
        canManageChapterSettings: false,
        canManageEventSettings: false,
        canManagePitch: false,
        canManageRegistrations: false,
        canDecideRegistrations: false,
        canViewRelevantNote: false,
        canEditRelevantNote: false,
        canViewRelevantNoteRevisions: false,
      },
    },
    {
      label: 'signed-out user',
      chapterContext: {
        actor: null,
        membership: null,
      },
      eventContext: {
        actor: null,
        chapterMembership: null,
        staff: null,
      },
      organizerContext: {
        actor: null,
        chapterMembership: null,
        staff: null,
        targetIsRelevantToChapter: true,
        targetIsRelevantToEvent: true,
      },
      expected: {
        canViewPublicChapter: true,
        canViewPrivateChapter: false,
        canManageChapterSettings: false,
        canManageEventSettings: false,
        canManagePitch: false,
        canManageRegistrations: false,
        canDecideRegistrations: false,
        canViewRelevantNote: false,
        canEditRelevantNote: false,
        canViewRelevantNoteRevisions: false,
      },
    },
  ];

  describe('permission matrix', () => {
    const publicChapter = buildChapter({
      accessMode: 'PUBLIC',
      status: 'ACTIVE',
    });
    const privateChapter = buildChapter({
      accessMode: 'PRIVATE',
      status: 'ACTIVE',
    });

    it.each(permissionCases)(
      'evaluates chapter visibility for $label',
      ({ chapterContext, expected }) => {
        expect(
          canViewChapterWithContext({
            ...chapterContext,
            chapter: publicChapter,
          })
        ).toBe(expected.canViewPublicChapter);

        expect(
          canViewChapterWithContext({
            ...chapterContext,
            chapter: privateChapter,
          })
        ).toBe(expected.canViewPrivateChapter);
      }
    );

    it.each([
      {
        label: 'site admin',
        eventContext: permissionCases[0].eventContext,
        expected: {
          workspace: true,
          administration: true,
          operations: true,
          communications: true,
          materials: true,
          notes: true,
          pitch: true,
          applicantDecisions: true,
        },
      },
      {
        label: 'active chapter admin in the event chapter',
        eventContext: permissionCases[1].eventContext,
        expected: {
          workspace: true,
          administration: true,
          operations: true,
          communications: true,
          materials: true,
          notes: true,
          pitch: true,
          applicantDecisions: true,
        },
      },
      {
        label: 'active chapter member without an event assignment',
        eventContext: permissionCases[2].eventContext,
        expected: {
          workspace: false,
          administration: false,
          operations: false,
          communications: false,
          materials: false,
          notes: false,
          pitch: false,
          applicantDecisions: false,
        },
      },
      {
        label: 'revoked chapter admin without an event assignment',
        eventContext: {
          actor: actorContext(chapterAdmin.hacker),
          chapterMembership: chapterMembershipContext({
            ...chapterAdmin.membership,
            status: 'REVOKED',
          }),
          staff: null,
        },
        expected: {
          workspace: false,
          administration: false,
          operations: false,
          communications: false,
          materials: false,
          notes: false,
          pitch: false,
          applicantDecisions: false,
        },
      },
      {
        label: 'assigned event MC',
        eventContext: permissionCases[3].eventContext,
        expected: {
          workspace: true,
          administration: false,
          operations: true,
          communications: true,
          materials: true,
          notes: true,
          pitch: true,
          applicantDecisions: true,
        },
      },
      {
        label: 'assigned event co-MC',
        eventContext: permissionCases[4].eventContext,
        expected: {
          workspace: true,
          administration: false,
          operations: true,
          communications: true,
          materials: true,
          notes: true,
          pitch: true,
          applicantDecisions: false,
        },
      },
      {
        label: 'regular signed-in user',
        eventContext: permissionCases[5].eventContext,
        expected: {
          workspace: false,
          administration: false,
          operations: false,
          communications: false,
          materials: false,
          notes: false,
          pitch: false,
          applicantDecisions: false,
        },
      },
      {
        label: 'signed-out user',
        eventContext: permissionCases[6].eventContext,
        expected: {
          workspace: false,
          administration: false,
          operations: false,
          communications: false,
          materials: false,
          notes: false,
          pitch: false,
          applicantDecisions: false,
        },
      },
    ])(
      'evaluates organizer workspace capabilities for $label',
      ({ eventContext, expected }) => {
        expect(canAccessEventWorkspaceWithContext(eventContext)).toBe(
          expected.workspace
        );
        expect(canAdministerEventWithContext(eventContext)).toBe(
          expected.administration
        );
        expect(canManageEventOperationsWithContext(eventContext)).toBe(
          expected.operations
        );
        expect(canManageEventCommunicationsWithContext(eventContext)).toBe(
          expected.communications
        );
        expect(canManageEventMaterialsWithContext(eventContext)).toBe(
          expected.materials
        );
        expect(canManageEventNotesWithContext(eventContext)).toBe(
          expected.notes
        );
        expect(canManageEventPitchWithContext(eventContext)).toBe(
          expected.pitch
        );
        expect(canDecideEventApplicantsWithContext(eventContext)).toBe(
          expected.applicantDecisions
        );
      }
    );

    it.each(permissionCases)(
      'evaluates chapter settings for $label',
      ({ chapterContext, expected }) => {
        expect(canManageChapterSettingsWithContext(chapterContext)).toBe(
          expected.canManageChapterSettings
        );
      }
    );

    it.each(permissionCases)(
      'evaluates event settings, pitch, and registration boundaries for $label',
      ({ eventContext, expected }) => {
        expect(canManageEventSettingsWithContext(eventContext)).toBe(
          expected.canManageEventSettings
        );
        expect(canManagePitchWithContext(eventContext)).toBe(
          expected.canManagePitch
        );
        expect(canManageRegistrationsWithContext(eventContext)).toBe(
          expected.canManageRegistrations
        );
        expect(canDecideRegistrationsWithContext(eventContext)).toBe(
          expected.canDecideRegistrations
        );
      }
    );

    it.each([
      {
        label: 'chapter admin',
        eventContext: permissionCases[1].eventContext,
        expected: {
          canPublishEvent: true,
          canReviewRegistrations: true,
          canDecideEventRegistration: true,
          canEditRegistrationNotes: true,
          isCoMcNoteOnlyRegistrationReviewer: false,
          canViewBannedUserReviewContext: false,
          canIncludeBannedUsersInReview: false,
        },
      },
      {
        label: 'event MC',
        eventContext: permissionCases[3].eventContext,
        expected: {
          canPublishEvent: false,
          canReviewRegistrations: true,
          canDecideEventRegistration: true,
          canEditRegistrationNotes: true,
          isCoMcNoteOnlyRegistrationReviewer: false,
          canViewBannedUserReviewContext: false,
          canIncludeBannedUsersInReview: false,
        },
      },
      {
        label: 'event co-MC',
        eventContext: permissionCases[4].eventContext,
        expected: {
          canPublishEvent: false,
          canReviewRegistrations: true,
          canDecideEventRegistration: false,
          canEditRegistrationNotes: true,
          isCoMcNoteOnlyRegistrationReviewer: true,
          canViewBannedUserReviewContext: false,
          canIncludeBannedUsersInReview: false,
        },
      },
      {
        label: 'site admin',
        eventContext: permissionCases[0].eventContext,
        expected: {
          canPublishEvent: true,
          canReviewRegistrations: true,
          canDecideEventRegistration: true,
          canEditRegistrationNotes: true,
          isCoMcNoteOnlyRegistrationReviewer: false,
          canViewBannedUserReviewContext: true,
          canIncludeBannedUsersInReview: true,
        },
      },
    ])(
      'evaluates registration review matrix for $label',
      ({ eventContext, expected }) => {
        expect(canPublishEventWithContext(eventContext)).toBe(
          expected.canPublishEvent
        );
        expect(canReviewRegistrationsWithContext(eventContext)).toBe(
          expected.canReviewRegistrations
        );
        expect(canDecideEventRegistrationWithContext(eventContext)).toBe(
          expected.canDecideEventRegistration
        );
        expect(canEditRegistrationNotesWithContext(eventContext)).toBe(
          expected.canEditRegistrationNotes
        );
        expect(
          isCoMcNoteOnlyRegistrationReviewerWithContext(eventContext)
        ).toBe(expected.isCoMcNoteOnlyRegistrationReviewer);
        expect(canViewBannedUserReviewContextWithContext(eventContext)).toBe(
          expected.canViewBannedUserReviewContext
        );
        expect(canIncludeBannedUsersInReviewWithContext(eventContext)).toBe(
          expected.canIncludeBannedUsersInReview
        );
      }
    );

    it.each(permissionCases)(
      'evaluates organizer note and revision access for $label',
      ({ organizerContext, expected }) => {
        expect(canViewOrganizerNoteWithContext(organizerContext)).toBe(
          expected.canViewRelevantNote
        );
        expect(canEditOrganizerNoteWithContext(organizerContext)).toBe(
          expected.canEditRelevantNote
        );
        expect(
          canViewOrganizerNoteRevisionsWithContext(organizerContext)
        ).toBe(expected.canViewRelevantNoteRevisions);
      }
    );
  });

  describe('chapter visibility edge cases', () => {
    const invitedMember = buildChapterMembershipContext({
      status: 'INVITED',
    });
    const revokedMember = buildChapterMembershipContext({
      status: 'REVOKED',
    });

    it('allows invited members to see private chapters before joining', () => {
      expect(
        canViewChapterWithContext({
          actor: actorContext(regularUser),
          chapter: buildChapter({ accessMode: 'PRIVATE' }),
          membership: invitedMember,
        })
      ).toBe(true);
    });

    it('does not expose inactive public chapters to non-members', () => {
      expect(
        canViewChapterWithContext({
          actor: actorContext(regularUser),
          chapter: buildChapter({ accessMode: 'PUBLIC', status: 'PAUSED' }),
          membership: null,
        })
      ).toBe(false);
    });

    it('does not let revoked memberships bypass private chapter visibility', () => {
      expect(
        canViewChapterWithContext({
          actor: actorContext(regularUser),
          chapter: buildChapter({ accessMode: 'PRIVATE' }),
          membership: revokedMember,
        })
      ).toBe(false);
    });
  });

  describe('organizer note relevance boundaries', () => {
    const chapterAdminContext: OrganizerNotePermissionContext = {
      actor: actorContext(chapterAdmin.hacker),
      chapterMembership: chapterMembershipContext(chapterAdmin.membership),
      staff: null,
    };
    const mcContext: OrganizerNotePermissionContext = {
      actor: actorContext(mc.hacker),
      chapterMembership: null,
      staff: staffContext(mc.staff),
    };
    const coMcContext: OrganizerNotePermissionContext = {
      actor: actorContext(coMc.hacker),
      chapterMembership: null,
      staff: staffContext(coMc.staff),
    };

    it('limits chapter admins to notes relevant to their chapter or chapter events', () => {
      expect(
        canViewOrganizerNoteWithContext({
          ...chapterAdminContext,
          targetIsRelevantToChapter: true,
          targetIsRelevantToEvent: false,
        })
      ).toBe(true);
      expect(
        canViewOrganizerNoteRevisionsWithContext({
          ...chapterAdminContext,
          targetIsRelevantToChapter: false,
          targetIsRelevantToEvent: true,
        })
      ).toBe(true);
      expect(
        canViewOrganizerNoteWithContext({
          ...chapterAdminContext,
          targetIsRelevantToChapter: false,
          targetIsRelevantToEvent: false,
        })
      ).toBe(false);
      expect(
        canViewOrganizerNoteRevisionsWithContext({
          ...chapterAdminContext,
          targetIsRelevantToChapter: false,
          targetIsRelevantToEvent: false,
        })
      ).toBe(false);
    });

    it('allows event staff to edit only event-relevant current notes, never revisions', () => {
      for (const staffPermissionContext of [mcContext, coMcContext]) {
        expect(
          canEditOrganizerNoteWithContext({
            ...staffPermissionContext,
            targetIsRelevantToChapter: false,
            targetIsRelevantToEvent: true,
          })
        ).toBe(true);
        expect(
          canViewOrganizerNoteWithContext({
            ...staffPermissionContext,
            targetIsRelevantToChapter: true,
            targetIsRelevantToEvent: false,
          })
        ).toBe(false);
        expect(
          canViewOrganizerNoteRevisionsWithContext({
            ...staffPermissionContext,
            targetIsRelevantToChapter: false,
            targetIsRelevantToEvent: true,
          })
        ).toBe(false);
      }
    });
  });

  describe('indexed permission query shapes', () => {
    it('looks up event staff through eventId, hackerId, and staff role filters', async () => {
      const prisma = {
        eventStaff: {
          findFirst: jest.fn().mockResolvedValue(mc.staff),
        },
      };

      await expect(
        getEventStaffForPermissions(
          prisma as any,
          mc.hacker.id,
          mc.staff.eventId
        )
      ).resolves.toBe(mc.staff);

      expect(prisma.eventStaff.findFirst).toHaveBeenCalledWith({
        where: {
          eventId: mc.staff.eventId,
          hackerId: mc.hacker.id,
          role: { in: ['MC', 'CO_MC'] },
        },
        select: {
          id: true,
          eventId: true,
          hackerId: true,
          role: true,
        },
      });
    });

    it('checks registration relevance through eventId and hackerId', async () => {
      const prisma = {
        eventRegistration: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'registration-1',
            eventId: mc.staff.eventId,
            hackerId: regularUser.id,
          }),
        },
      };

      await expect(
        hasEventRegistrationForPermissions(
          prisma as any,
          regularUser.id,
          mc.staff.eventId
        )
      ).resolves.toBe(true);

      expect(prisma.eventRegistration.findFirst).toHaveBeenCalledWith({
        where: { eventId: mc.staff.eventId, hackerId: regularUser.id },
        select: { id: true, eventId: true, hackerId: true },
      });
    });

    it('checks chapter note relevance through membership and registration chapter indexes', async () => {
      const prisma = {
        chapterMembership: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        eventRegistration: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'registration-1',
            eventId: mc.staff.eventId,
            hackerId: regularUser.id,
          }),
        },
      };

      await expect(
        hasChapterOrganizerNoteRelevance(
          prisma as any,
          regularUser.id,
          chapterAdmin.chapter.id
        )
      ).resolves.toBe(true);

      expect(prisma.chapterMembership.findFirst).toHaveBeenCalledWith({
        where: {
          chapterId: chapterAdmin.chapter.id,
          hackerId: regularUser.id,
          status: { in: ['ACTIVE', 'INVITED'] },
        },
        select: {
          id: true,
          chapterId: true,
          hackerId: true,
          role: true,
          status: true,
        },
      });
      expect(prisma.eventRegistration.findFirst).toHaveBeenCalledWith({
        where: {
          hackerId: regularUser.id,
          event: { chapterId: chapterAdmin.chapter.id },
        },
        select: { id: true, eventId: true, hackerId: true },
      });
    });
  });
});

function buildChapterMembershipContext(
  overrides: Partial<ChapterMembershipFixture>
): ChapterPermissionContext['membership'] {
  return chapterMembershipContext(
    buildChapterMemberFixture({ membership: overrides }).membership
  );
}
