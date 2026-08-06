'use client';

import Image from 'next/image';
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
import { ApplicationTemplateEditor } from '../../../../components/ApplicationTemplateEditor';
import { HackerSelector } from '../../../../components/HackerSelector';
import { HackerSearchSelect } from '../../../../components/HackerSearchSelect';
import type { HackerSelectionOption } from '@/types/hacker';
import { useUserContext } from '../../../../contexts/UserContext';
import type {
  AdminBanFlagListItem,
  ApplicationTemplateListItem,
  ChapterMembershipSummary,
  OrganizerChapterSettings,
} from '@/types/event-management';
import { CHAPTER_TIMEZONE_GROUPS } from '@/lib/chapterTimezones';

function firstChapter(payload: unknown): OrganizerChapterSettings | null {
  if (payload && typeof payload === 'object' && 'id' in payload) {
    return payload as OrganizerChapterSettings;
  }
  return null;
}

function hackerList(payload: unknown): HackerSelectionOption[] {
  const hackers = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        'hackers' in payload &&
        Array.isArray(payload.hackers)
      ? payload.hackers
      : [];

  return hackers.filter((hacker): hacker is HackerSelectionOption =>
    Boolean(
      hacker &&
        typeof hacker === 'object' &&
        'id' in hacker &&
        typeof hacker.id === 'string' &&
        'name' in hacker &&
        typeof hacker.name === 'string'
    )
  );
}

function templateList(payload: unknown): ApplicationTemplateListItem[] {
  if (!Array.isArray(payload)) return [];

  return (payload as ApplicationTemplateListItem[])
    .filter(template => template.scope === 'CHAPTER')
    .map(template => ({
      ...template,
      isActive:
        typeof template.isActive === 'boolean'
          ? template.isActive
          : (template as ApplicationTemplateListItem & { status?: string })
              .status === 'ACTIVE',
    }));
}

function replaceTemplate(
  templates: ApplicationTemplateListItem[],
  savedTemplate: ApplicationTemplateListItem
) {
  return templates.map(template =>
    template.id === savedTemplate.id
      ? {
          ...template,
          ...savedTemplate,
        }
      : savedTemplate.isActive &&
          template.scope === savedTemplate.scope &&
          template.chapterId === savedTemplate.chapterId
        ? { ...template, isActive: false }
        : template
  );
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
  const [templateMessage, setTemplateMessage] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [timezoneDraft, setTimezoneDraft] = useState('America/New_York');
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showAdminInvite, setShowAdminInvite] = useState(false);
  const [adminCandidates, setAdminCandidates] = useState<
    HackerSelectionOption[] | null
  >(null);
  const [adminHackerQuery, setAdminHackerQuery] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isLoadingAdminCandidates, setIsLoadingAdminCandidates] =
    useState(false);
  const [isInvitingAdmin, setIsInvitingAdmin] = useState(false);
  const [flagHackerQuery, setFlagHackerQuery] = useState('');
  const [selectedFlagHacker, setSelectedFlagHacker] =
    useState<HackerSelectionOption | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagMessage, setFlagMessage] = useState('');
  const [flagError, setFlagError] = useState('');
  const [isCreatingFlag, setIsCreatingFlag] = useState(false);

  const memberHackerOptions: HackerSelectionOption[] = members
    .filter(member => member.hacker?.id && member.hacker?.name)
    .map(member => ({
      id: member.hacker!.id,
      name: member.hacker!.name,
      email: member.hacker?.email ?? null,
    }));

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
            setAuthStatus(
              authStatusFromResponse(chapterResponse) ?? 'forbidden'
            );
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
        setDescriptionDraft(nextChapter.description ?? '');
        setTimezoneDraft(nextChapter.timezone);
        setMembers(Array.isArray(membersPayload) ? membersPayload : []);
        setTemplates(templateList(templatesPayload));
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

  async function saveChapterProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!chapter) return;

    setIsSavingProfile(true);
    setSettingsMessage('');
    setSettingsError('');

    try {
      const response = await fetch(`/api/chapters/${chapter.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          description: descriptionDraft.trim(),
          timezone: timezoneDraft,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Unable to save description.');
      }

      const updatedChapter = firstChapter(await response.json());
      if (updatedChapter) {
        setChapter(updatedChapter);
        setDescriptionDraft(updatedChapter.description ?? '');
        setTimezoneDraft(updatedChapter.timezone);
      }
      setSettingsMessage('Chapter profile saved.');
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : 'Unable to save chapter profile.'
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function uploadChapterImage(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (!chapter) return;
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setSettingsMessage('');
    setSettingsError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/chapters/${chapter.id}/image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Unable to upload chapter image.');
      }

      const updatedChapter = firstChapter(await response.json());
      if (updatedChapter) setChapter(updatedChapter);
      setSettingsMessage('Chapter image uploaded.');
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : 'Unable to upload chapter image.'
      );
    } finally {
      event.currentTarget.value = '';
      setIsUploadingImage(false);
    }
  }

  async function createChapterTemplate() {
    if (!chapter) return;

    setIsCreatingTemplate(true);
    setTemplateMessage('');
    setTemplateError('');

    try {
      const response = await fetch('/api/application-templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'CHAPTER',
          chapterId: chapter.id,
          name: `${chapter.name} application`,
          isActive: true,
          fieldsJson: [],
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Unable to create template.');
      }

      const template = await response.json();
      setTemplates(current => [...current, templateList([template])[0]]);
      setTemplateMessage('Chapter template created.');
    } catch (error) {
      setTemplateError(
        error instanceof Error ? error.message : 'Unable to create template.'
      );
    } finally {
      setIsCreatingTemplate(false);
    }
  }

  async function createFlag(event: React.FormEvent) {
    event.preventDefault();
    if (!chapter) return;
    if (!selectedFlagHacker) {
      setFlagError('Choose a hacker from the list.');
      return;
    }

    setIsCreatingFlag(true);
    setFlagMessage('');
    setFlagError('');

    try {
      const response = await fetch(`/api/chapters/${chapter.id}/ban-flags`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hackerId: selectedFlagHacker.id,
          reason: flagReason.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Unable to create ban flag.');
      }

      const flag = await response.json();
      setBanFlags(current => [flag, ...current]);
      setFlagHackerQuery('');
      setSelectedFlagHacker(null);
      setFlagReason('');
      setFlagMessage('Ban flag created.');
    } catch (error) {
      setFlagError(
        error instanceof Error ? error.message : 'Unable to create ban flag.'
      );
    } finally {
      setIsCreatingFlag(false);
    }
  }

  function handleSelectedFlagHackerChange(
    hacker: HackerSelectionOption | null
  ) {
    setSelectedFlagHacker(hacker);
    setFlagError('');
  }

  async function openAdminInvite() {
    setAdminMessage('');
    setAdminError('');

    if (adminCandidates) {
      setShowAdminInvite(true);
      return;
    }

    setIsLoadingAdminCandidates(true);
    try {
      const response = await fetch('/api/hackers');
      if (!response.ok) throw new Error('Unable to load hackers.');

      setAdminCandidates(hackerList(await response.json()));
      setShowAdminInvite(true);
    } catch (error) {
      setAdminError(
        error instanceof Error ? error.message : 'Unable to load hackers.'
      );
    } finally {
      setIsLoadingAdminCandidates(false);
    }
  }

  async function inviteAdmin(hacker: HackerSelectionOption) {
    if (!chapter || isInvitingAdmin) return;

    setIsInvitingAdmin(true);
    setShowAdminInvite(false);
    setAdminMessage('');
    setAdminError('');

    try {
      const response = await fetch(`/api/chapters/${chapter.id}/admins`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hackerId: hacker.id }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.message || payload?.error || 'Unable to add chapter admin.'
        );
      }

      const savedAdmin = (await response.json()) as ChapterMembershipSummary;
      setMembers(current => {
        const existingIndex = current.findIndex(
          member => member.hacker?.id === savedAdmin.hacker?.id
        );
        if (existingIndex === -1) return [...current, savedAdmin];
        return current.map((member, index) =>
          index === existingIndex ? savedAdmin : member
        );
      });
      setAdminMessage(`${hacker.name} is now a chapter admin.`);
      setAdminHackerQuery('');
    } catch (error) {
      setAdminError(
        error instanceof Error ? error.message : 'Unable to add chapter admin.'
      );
    } finally {
      setIsInvitingAdmin(false);
    }
  }

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
          title="Chapter profile"
          description="Public chapter details shown on chapter pages."
        >
          <form className="grid gap-4" onSubmit={saveChapterProfile}>
            {settingsError && (
              <ManagementAlert tone="danger">{settingsError}</ManagementAlert>
            )}
            {settingsMessage && (
              <ManagementAlert tone="success">
                {settingsMessage}
              </ManagementAlert>
            )}
            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="min-w-0">
                {chapter.heroImage?.url ? (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md">
                    <Image
                      alt={chapter.heroImage.alt || `${chapter.name} chapter`}
                      className="object-cover"
                      fill
                      sizes="180px"
                      src={chapter.heroImage.url}
                      unoptimized
                    />
                  </div>
                ) : (
                  <div
                    className={`${classes.subtlePanel} flex aspect-[4/3] items-center justify-center px-4 text-center text-sm ${classes.mutedText}`}
                  >
                    No chapter image
                  </div>
                )}
              </div>
              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Timezone</span>
                  <select
                    aria-label="Timezone"
                    className={classes.input}
                    value={timezoneDraft}
                    onChange={event => setTimezoneDraft(event.target.value)}
                  >
                    {CHAPTER_TIMEZONE_GROUPS.map(group => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label} ({option.value})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Chapter image</span>
                  <input
                    aria-label="Chapter image"
                    accept="image/*"
                    className={classes.input}
                    disabled={isUploadingImage}
                    onChange={uploadChapterImage}
                    type="file"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">
                    Chapter description
                  </span>
                  <textarea
                    aria-label="Chapter description"
                    className={`${classes.textarea} block w-full`}
                    value={descriptionDraft}
                    onChange={event => setDescriptionDraft(event.target.value)}
                    placeholder="Public chapter description"
                  />
                </label>
                <div>
                  <button
                    className={classes.primaryButton}
                    disabled={isSavingProfile || isUploadingImage}
                    type="submit"
                  >
                    {isSavingProfile ? 'Saving...' : 'Save profile'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </ManagementSection>

        <ManagementSection
          title="Application template"
          description="Add local application questions for this chapter."
          actions={
            !templates.some(template => template.scope === 'CHAPTER') ? (
              <button
                className={classes.primaryButton}
                disabled={isCreatingTemplate}
                onClick={createChapterTemplate}
                type="button"
              >
                {isCreatingTemplate ? 'Creating...' : 'Create chapter template'}
              </button>
            ) : null
          }
        >
          <div className="grid gap-3">
            {templateError && (
              <ManagementAlert tone="danger">{templateError}</ManagementAlert>
            )}
            {templateMessage && (
              <ManagementAlert tone="success">
                {templateMessage}
              </ManagementAlert>
            )}
            {templates.map(template => (
              <ApplicationTemplateEditor
                key={template.id}
                template={template}
                canEdit={template.scope === 'CHAPTER'}
                onSaved={savedTemplate =>
                  setTemplates(current =>
                    replaceTemplate(current, savedTemplate)
                  )
                }
                onDeleted={templateId =>
                  setTemplates(current =>
                    current.filter(template => template.id !== templateId)
                  )
                }
              />
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
            <button
              className={classes.primaryButton}
              disabled={isLoadingAdminCandidates || isInvitingAdmin}
              onClick={openAdminInvite}
              type="button"
            >
              {isLoadingAdminCandidates ? 'Loading hackers...' : 'Invite admin'}
            </button>
          }
        >
          <HackerSelector
            showModal={showAdminInvite}
            setShowModal={setShowAdminInvite}
            isDarkMode={classes.isDarkMode}
            searchTerm={adminHackerQuery}
            setSearchTerm={setAdminHackerQuery}
            filteredHackers={(adminCandidates ?? []).filter(candidate => {
              const isAdmin = members.some(
                member =>
                  member.role === 'ADMIN' && member.hacker?.id === candidate.id
              );
              const query = adminHackerQuery.trim().toLowerCase();
              return (
                !isAdmin &&
                (!query ||
                  candidate.name.toLowerCase().includes(query) ||
                  (candidate.email ?? '').toLowerCase().includes(query))
              );
            })}
            handleAddMember={inviteAdmin}
            title="Invite Chapter Admin"
            singleSelect
            selectedIds={members
              .filter(member => member.role === 'ADMIN')
              .flatMap(member => (member.hacker?.id ? [member.hacker.id] : []))}
            showRoleSelector={false}
          />
          {adminError && (
            <div className="mb-4">
              <ManagementAlert tone="danger">{adminError}</ManagementAlert>
            </div>
          )}
          {adminMessage && (
            <div className="mb-4">
              <ManagementAlert tone="success">{adminMessage}</ManagementAlert>
            </div>
          )}
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
        >
          <form
            onSubmit={createFlag}
            className={`${classes.subtlePanel} mb-4 grid gap-3 p-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] md:items-end`}
          >
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Hacker</span>
              <HackerSearchSelect
                ariaLabel="Search hacker to flag"
                disabled={isCreatingFlag}
                hackers={memberHackerOptions}
                query={flagHackerQuery}
                selectedHacker={selectedFlagHacker}
                onQueryChange={setFlagHackerQuery}
                onSelectedHackerChange={handleSelectedFlagHackerChange}
                placeholder="Hacker name"
                noResultsText="No chapter members found."
              />
            </div>
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Reason</span>
              <input
                aria-label="Flag reason"
                className={classes.input}
                placeholder="What needs site-admin review?"
                value={flagReason}
                onChange={event => setFlagReason(event.target.value)}
              />
            </label>
            <button
              className={classes.secondaryButton}
              disabled={
                isCreatingFlag || !selectedFlagHacker || !flagReason.trim()
              }
              type="submit"
            >
              {isCreatingFlag ? 'Creating...' : 'Create flag'}
            </button>
          </form>
          {flagError && (
            <div className="mb-4">
              <ManagementAlert tone="danger">{flagError}</ManagementAlert>
            </div>
          )}
          {flagMessage && (
            <div className="mb-4">
              <ManagementAlert tone="success">{flagMessage}</ManagementAlert>
            </div>
          )}
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
