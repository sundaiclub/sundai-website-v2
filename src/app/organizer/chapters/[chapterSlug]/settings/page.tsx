"use client";

import { useEffect, useState } from "react";
import OrganizerNotePanel from "../../../../components/OrganizerNotePanel";
import { useUserContext } from "../../../../contexts/UserContext";

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
  if (payload && typeof payload === "object" && "id" in payload) {
    return payload as Chapter;
  }
  return null;
}

export default function OrganizerChapterSettingsPage({
  params,
}: {
  params: { chapterSlug: string };
}) {
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
        const chapterResponse = await fetch(`/api/chapters/${params.chapterSlug}`);
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

        const [membersResponse, templatesResponse, banFlagsResponse] = await Promise.all([
          fetch(`/api/chapters/${nextChapter.id}/members`),
          fetch(`/api/application-templates?chapterId=${nextChapter.id}`),
          fetch(`/api/chapters/${nextChapter.id}/ban-flags`),
        ]);

        const [membersPayload, templatesPayload, banFlagsPayload] = await Promise.all([
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
      <main className="min-h-screen bg-white text-gray-900 font-space-mono">
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          Loading...
        </div>
      </main>
    );
  }

  if (denied && !isAdmin) {
    return (
      <main className="min-h-screen bg-white text-gray-900 font-space-mono">
        <div className="max-w-5xl mx-auto px-4 py-20 text-red-500">
          You do not have permission to view this page.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900 font-space-mono">
      <div className="max-w-5xl mx-auto px-4 py-20">
        <h1 className="text-3xl font-bold mb-6">
          {chapter?.name || "Chapter settings"}
        </h1>
        <div className="mb-6 text-sm">
          {chapter?.status || "ACTIVE"} / {chapter?.accessMode || "PRIVATE"}
        </div>
        <section className="grid gap-6">
          <div>
            <h2 className="text-xl font-bold">Settings</h2>
            <label className="block mt-3">
              Default declined message
              <textarea
                className="block border rounded px-3 py-2 mt-2 w-full"
                defaultValue={chapter?.defaultDeclineMessage ?? ""}
              />
            </label>
          </div>
          <div>
            <h2 className="text-xl font-bold">Application template</h2>
            {templates.map((template) => (
              <div key={template.id} className="mt-2">
                <div className="font-semibold">{template.name}</div>
                <div className="text-sm opacity-70">
                  {(template.fieldsJson ?? []).map((field) => field.label).join(", ")}
                </div>
              </div>
            ))}
            <button className="border rounded px-4 py-2 mt-2" type="button">
              Save template
            </button>
          </div>
          <div id="admins">
            <h2 className="text-xl font-bold">Admins</h2>
            {members
              .filter((member) => member.role === "ADMIN")
              .map((member) => (
                <div key={member.id} className="mt-2">
                  {member.hacker?.name} / {member.status}
                </div>
              ))}
            <button className="border rounded px-4 py-2 mt-2" type="button">
              Invite admin
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold">Members</h2>
            {members.map((member) => (
              <div key={member.id} className="mt-2">
                <span>{member.hacker?.name}</span>
                <span className="ml-2">{member.status}</span>
                <span className="ml-2">
                  Notifications {member.notificationsAllowed ? "enabled" : "disabled"}
                </span>
              </div>
            ))}
            <button className="border rounded px-4 py-2 mt-2" type="button">
              Invite member
            </button>
          </div>
          <div>
            <h2 className="text-xl font-bold">Organizer notes</h2>
            {members
              .filter((member) => member.hacker?.id)
              .map((member) => (
                <OrganizerNotePanel
                  hackerId={member.hacker!.id!}
                  key={member.id}
                  title={`Organizer note for ${member.hacker?.name || "member"}`}
                />
              ))}
          </div>
          <div>
            <h2 className="text-xl font-bold">Ban flags</h2>
            {banFlags.map((flag) => (
              <div key={flag.id} className="mt-2">
                <span>{flag.hacker?.name}</span>
                <span className="ml-2">{flag.reason}</span>
              </div>
            ))}
            <button className="border rounded px-4 py-2 mt-2" type="button">
              Create flag
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
