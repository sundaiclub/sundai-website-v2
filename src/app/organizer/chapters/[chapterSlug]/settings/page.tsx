'use client';

import { useEffect, useState } from 'react';
import {
  AuthStatusAlert,
  authStatusFromResponse,
  type AuthStatus,
} from '../../../../components/AuthStatusAlert';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import { useUserContext } from '../../../../contexts/UserContext';
import type {
  AdminBanFlagListItem,
  ApplicationTemplateListItem,
  ChapterMembershipSummary,
  OrganizerChapterSettings,
} from '@/types/event-management';

function firstChapter(payload: unknown): OrganizerChapterSettings | null {
  if (payload && typeof payload === 'object' && 'id' in payload) {
    return payload as OrganizerChapterSettings;
  }
  return null;
}

export default function OrganizerChapterSettingsPage({
  params,
}: {
  params: { chapterSlug: string };
}) {
  const classes = useManagementClasses();
  const { loading } = useUserContext();
  const [chapter, setChapter] = useState<OrganizerChapterSettings | null>(null);
  const [members, setMembers] = useState<ChapterMembershipSummary[]>([]);
  const [templates, setTemplates] = useState<ApplicationTemplateListItem[]>([]);
  const [banFlags, setBanFlags] = useState<AdminBanFlagListItem[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    async function loadChapterSettings() {
      setIsLoading(true);
      setAuthStatus(null);
      setLoadError('');
      setChapter(null);
      setMembers([]);
      setTemplates([]);
      setBanFlags([]);

      try {
        const chapterResponse = await fetch(
          `/api/chapters/${params.chapterSlug}`
        );
        if (!chapterResponse.ok) {
          if (isCurrent) {
            setAuthStatus(authStatusFromResponse(chapterResponse) ?? 'forbidden');
          }
          return;
        }

        const chapterPayload = await chapterResponse.json();
        const nextChapter = firstChapter(chapterPayload);
        if (!nextChapter) {
          if (isCurrent) setAuthStatus('not-found');
          return;
        }

        const [membersResponse, templatesResponse, banFlagsResponse] =
          await Promise.all([
            fetch(`/api/chapters/${nextChapter.id}/members`),
            fetch(`/api/application-templates?chapterId=${nextChapter.id}`),
            fetch(`/api/chapters/${nextChapter.id}/ban-flags`),
          ]);

        const authResponse = [
          membersResponse,
          templatesResponse,
          banFlagsResponse,
        ].find(response => authStatusFromResponse(response));

        if (authResponse) {
          if (isCurrent) setAuthStatus(authStatusFromResponse(authResponse));
          return;
        }

        if (
          !membersResponse.ok ||
          !templatesResponse.ok ||
          !banFlagsResponse.ok
        ) {
          throw new Error('Unable to load chapter settings');
        }

        const [membersPayload, templatesPayload, banFlagsPayload] =
          await Promise.all([
            membersResponse.json(),
            templatesResponse.json(),
            banFlagsResponse.json(),
          ]);

        if (!isCurrent) return;

        setChapter(nextChapter);
        setMembers(Array.isArray(membersPayload) ? membersPayload : []);
        setTemplates(Array.isArray(templatesPayload) ? templatesPayload : []);
        setBanFlags(Array.isArray(banFlagsPayload) ? banFlagsPayload : []);
      } catch {
        if (isCurrent) setLoadError('Unable to load chapter settings.');
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadChapterSettings();

    return () => {
      isCurrent = false;
    };
  }, [params.chapterSlug]);

  if (isLoading || (authStatus && loading)) {
    return (
      <ManagementPage maxWidth="max-w-5xl">
        <ManagementAlert>Loading...</ManagementAlert>
      </ManagementPage>
    );
  }

  if (authStatus) {
    return (
      <ManagementPage maxWidth="max-w-5xl">
        <AuthStatusAlert status={authStatus} />
      </ManagementPage>
    );
  }

  if (loadError || !chapter) {
    return (
      <ManagementPage maxWidth="max-w-5xl">
        <ManagementAlert tone="danger">
          {loadError || 'Unable to load chapter settings.'}
        </ManagementAlert>
      </ManagementPage>
    );
  }

  return (
    <ManagementPage maxWidth="max-w-5xl">
      <div className="mb-4">
        <ManagementBackButton />
      </div>
      <ManagementHeader
        eyebrow="Organizer"
        title={chapter?.name || 'Chapter settings'}
        description="Manage chapter operations, application defaults, member access, and local moderation signals."
        actions={
          <>
            <ManagementBadge tone="success">
              {chapter?.status || 'ACTIVE'}
            </ManagementBadge>
            <ManagementBadge>
              {chapter?.accessMode || 'PRIVATE'}
            </ManagementBadge>
          </>
        }
      />
      <div className="grid gap-5">
        <ManagementSection
          title="Settings"
          description="Operational defaults used by this chapter."
        >
          <label className="block">
            <span className="text-sm font-semibold">
              Default declined-user message
            </span>
            <textarea
              className={`${classes.textarea} mt-2 block w-full`}
              defaultValue={chapter?.defaultDeclineMessage ?? ''}
            />
          </label>
        </ManagementSection>

        <ManagementSection
          title="Application template"
          description="Chapter questions are composed with the site-required fields."
          actions={
            <button className={classes.secondaryButton} type="button">
              Save template
            </button>
          }
        >
          <div className="grid gap-3">
            {templates.map(template => (
              <div key={template.id} className={`${classes.subtlePanel} p-4`}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold">{template.name}</div>
                  <ManagementBadge>{template.scope}</ManagementBadge>
                </div>
                <div className={`mt-2 text-sm ${classes.mutedText}`}>
                  {(template.fieldsJson ?? [])
                    .map(field => field.label)
                    .join(', ') || 'No fields configured'}
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <ManagementEmptyState>
                No application templates are configured.
              </ManagementEmptyState>
            )}
          </div>
        </ManagementSection>

        <ManagementSection
          title="Admins"
          description="People who can manage this chapter."
          actions={
            <button className={classes.primaryButton} type="button">
              Invite admin
            </button>
          }
        >
          <div id="admins" className={`divide-y ${classes.divider}`}>
            {members
              .filter(member => member.role === 'ADMIN')
              .map(member => (
                <div
                  key={member.id}
                  className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {member.hacker?.name ||
                        member.hacker?.email ||
                        'Unnamed admin'}
                    </div>
                    {member.hacker?.email && (
                      <div className={`truncate text-sm ${classes.mutedText}`}>
                        {member.hacker.email}
                      </div>
                    )}
                  </div>
                  <ManagementBadge
                    tone={member.status === 'ACTIVE' ? 'success' : 'warning'}
                  >
                    {member.status}
                  </ManagementBadge>
                </div>
              ))}
            {members.filter(member => member.role === 'ADMIN').length === 0 && (
              <ManagementEmptyState>
                No chapter admins found.
              </ManagementEmptyState>
            )}
          </div>
        </ManagementSection>

        <ManagementSection
          title="Members"
          description="Membership and notification state for this chapter."
          actions={
            <button className={classes.secondaryButton} type="button">
              Invite member
            </button>
          }
        >
          <div className={`divide-y ${classes.divider}`}>
            {members.map(member => (
              <div
                key={member.id}
                className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {member.hacker?.name ||
                      member.hacker?.email ||
                      'Unnamed member'}
                  </div>
                  {member.hacker?.email && (
                    <div className={`truncate text-sm ${classes.mutedText}`}>
                      {member.hacker.email}
                    </div>
                  )}
                </div>
                <ManagementBadge
                  tone={member.status === 'ACTIVE' ? 'success' : 'warning'}
                >
                  {member.status}
                </ManagementBadge>
                <div className={`text-sm ${classes.mutedText}`}>
                  Notifications{' '}
                  {member.notificationsAllowed ? 'enabled' : 'disabled'}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <ManagementEmptyState>
                No members have been added.
              </ManagementEmptyState>
            )}
          </div>
        </ManagementSection>

        <ManagementSection
          title="Ban flags"
          description="Chapter-level moderation flags that need review."
          actions={
            <button className={classes.secondaryButton} type="button">
              Create flag
            </button>
          }
        >
          <div className={`divide-y ${classes.divider}`}>
            {banFlags.map(flag => (
              <div
                key={flag.id}
                className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">
                    {flag.hacker?.name || 'Flagged hacker'}
                  </div>
                  <div className={`mt-1 text-sm ${classes.mutedText}`}>
                    {flag.reason}
                  </div>
                </div>
                <ManagementBadge
                  tone={flag.status === 'OPEN' ? 'warning' : 'default'}
                >
                  {flag.status}
                </ManagementBadge>
              </div>
            ))}
            {banFlags.length === 0 && (
              <ManagementEmptyState>
                No ban flags are open.
              </ManagementEmptyState>
            )}
          </div>
        </ManagementSection>
      </div>
    </ManagementPage>
  );
}
