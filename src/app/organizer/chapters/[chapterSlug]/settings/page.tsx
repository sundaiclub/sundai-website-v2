'use client';

import { useEffect, useState } from 'react';
import OrganizerNotePanel from '../../../../components/OrganizerNotePanel';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import { useUserContext } from '../../../../contexts/UserContext';

type Chapter = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  accessMode?: string;
  defaultDeclineMessage?: string | null;
};

type Member = {
  id: string;
  role: string;
  status: string;
  notificationsAllowed?: boolean;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  hacker?: { id?: string; name?: string | null; email?: string | null };
};

type Template = {
  id: string;
  name: string;
  scope: string;
  fieldsJson?: Array<{ label: string }>;
};

type BanFlag = {
  id: string;
  reason: string;
  status: string;
  hacker?: { name?: string | null };
};

function firstChapter(payload: unknown): Chapter | null {
  if (payload && typeof payload === 'object' && 'id' in payload) {
    return payload as Chapter;
  }
  return null;
}

export default function OrganizerChapterSettingsPage({
  params,
}: {
  params: { chapterSlug: string };
}) {
  const classes = useManagementClasses();
  const { isAdmin, loading } = useUserContext();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [banFlags, setBanFlags] = useState<BanFlag[]>([]);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    async function loadChapterSettings() {
      try {
        const chapterResponse = await fetch(
          `/api/chapters/${params.chapterSlug}`
        );
        if (!chapterResponse.ok) {
          if (isCurrent) setDenied(true);
          return;
        }

        const chapterPayload = await chapterResponse.json();
        const nextChapter = firstChapter(chapterPayload);
        if (!nextChapter) {
          if (isCurrent) setDenied(true);
          return;
        }

        if (isCurrent) {
          setChapter(nextChapter);
          setDenied(false);
        }

        const [membersResponse, templatesResponse, banFlagsResponse] =
          await Promise.all([
            fetch(`/api/chapters/${nextChapter.id}/members`),
            fetch(`/api/application-templates?chapterId=${nextChapter.id}`),
            fetch(`/api/chapters/${nextChapter.id}/ban-flags`),
          ]);

        const [membersPayload, templatesPayload, banFlagsPayload] =
          await Promise.all([
            membersResponse.ok ? membersResponse.json() : [],
            templatesResponse.ok ? templatesResponse.json() : [],
            banFlagsResponse.ok ? banFlagsResponse.json() : [],
          ]);

        if (!isCurrent) return;

        setMembers(Array.isArray(membersPayload) ? membersPayload : []);
        setTemplates(Array.isArray(templatesPayload) ? templatesPayload : []);
        setBanFlags(Array.isArray(banFlagsPayload) ? banFlagsPayload : []);
      } catch {
        if (isCurrent) setDenied(true);
      }
    }

    loadChapterSettings();

    return () => {
      isCurrent = false;
    };
  }, [params.chapterSlug]);

  if (denied && loading) {
    return (
      <ManagementPage maxWidth="max-w-5xl">
        <ManagementAlert>Loading...</ManagementAlert>
      </ManagementPage>
    );
  }

  if (denied && !isAdmin) {
    return (
      <ManagementPage maxWidth="max-w-5xl">
        <ManagementAlert tone="danger">
          You do not have permission to view this page.
        </ManagementAlert>
      </ManagementPage>
    );
  }

  return (
    <ManagementPage maxWidth="max-w-5xl">
      <ManagementHeader
        eyebrow="Organizer"
        title={chapter?.name || 'Chapter settings'}
        description="Manage chapter operations, application defaults, member access, notes, and local moderation signals."
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
          title="Organizer notes"
          description="Private context visible to authorized organizers."
        >
          <div className="grid gap-3">
            {members
              .filter(member => member.hacker?.id)
              .map(member => (
                <OrganizerNotePanel
                  hackerId={member.hacker!.id!}
                  key={member.id}
                  title={`Organizer note for ${member.hacker?.name || 'member'}`}
                />
              ))}
            {members.filter(member => member.hacker?.id).length === 0 && (
              <ManagementEmptyState>
                No member notes are available.
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
