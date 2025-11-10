"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import NextImage from "next/image";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";
import { Project, ProjectCard } from "../../components/Project";
import { HackerSelector, type Hacker } from "../../components/HackerSelector";
import { HeartIcon } from "@heroicons/react/24/outline";
import { HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

type EventDetail = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  meetingUrl?: string | null;
  audienceCanReorder: boolean;
  isFinished: boolean;
  mcs: Array<{ id: string; hacker: { id: string; name: string } }>;
  projects: Array<{
    id: string;
    position: number;
    status: "QUEUED" | "APPROVED" | "CURRENT" | "DONE" | "SKIPPED";
    approved: boolean;
    project: Project;
  }>;
};

function StageBadge({ now, start }: { now: number; start: string }) {
  const notStarted = now < new Date(start).getTime();
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${notStarted ? "bg-yellow-200 text-yellow-800" : "bg-green-200 text-green-800"}`}>
      {notStarted ? "Not started" : "Live"}
    </span>
  );
}

export default function PitchEventPage() {
  const { isDarkMode } = useTheme();
  const { isAdmin, userInfo } = useUserContext();
  const params = useParams();
  const eventId = params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  // polling handled via effect cleanup

  // Join modal state
  const [showJoin, setShowJoin] = useState(false);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Edit Event modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editMeetingUrl, setEditMeetingUrl] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [allHackers, setAllHackers] = useState<Hacker[]>([]);
  const [selectedMCs, setSelectedMCs] = useState<string[]>([]);
  const [showMCSelector, setShowMCSelector] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        const data = await res.json();
        setEvent(data);
      } finally {
        setLoading(false);
      }
    }
    if (eventId) load();
    // Poll for live updates
    if (eventId) {
      const intervalMs = process.env.NODE_ENV === "production" ? 10000 : 4000;
      const handle = setInterval(load, intervalMs);
      const onFocus = () => load();
      const onVisibility = () => { if (!document.hidden) load(); };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        clearInterval(handle);
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }
  }, [eventId]);

  useEffect(() => {
    if (showMCSelector) {
      (async () => {
        try {
          const res = await fetch('/api/hackers');
          const hs = await res.json();
          setAllHackers(hs);
        } catch {}
      })();
    }
  }, [showMCSelector]);

  const currentItem = useMemo(() => event?.projects.find(p => p.status === "CURRENT"), [event]);
  const allOrdered = useMemo(() => (event?.projects || []).slice().sort((a,b)=>a.position-b.position), [event]);
  const isController = useMemo(() => (isAdmin || (event?.mcs || []).some(m=>m.hacker.id===userInfo?.id)) , [isAdmin, event?.mcs, userInfo?.id]);

  const openJoin = async () => {
    if (!userInfo) return alert("Sign in first");
    if (event?.isFinished) {
      alert("Event is finished. Queue is locked.");
      return;
    }
    const my = await fetch(`/api/projects?status=APPROVED&hacker_id=${encodeURIComponent(userInfo.id)}&limit=1000`);
    const all = await my.json();
    const items: Project[] = Array.isArray(all) ? all : (all?.items ?? []);
    const mine = items.filter((p: Project) => p.launchLead.id === userInfo.id || p.participants.some(pt => pt.hacker.id === userInfo.id));
    // Sort most recent first by startDate
    const sorted = [...mine].sort((a,b) => {
      const da = new Date((a as any).startDate).getTime();
      const db = new Date((b as any).startDate).getTime();
      return isNaN(db) || isNaN(da) ? 0 : db - da;
    });
    setMyProjects(sorted);
    setSelectedProjectId(sorted[0]?.id || "");
    setShowJoin(true);
  };

  const filteredMyProjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = myProjects;
    if (!q) return base;
    return base.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.preview || "").toLowerCase().includes(q)
    );
  }, [searchTerm, myProjects]);

  const confirmJoin = async () => {
    if (!selectedProjectId) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/events/${eventId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      if (res.status === 409) {
        alert("This project is already in the queue");
      }
      if (res.ok) {
        const updated = await fetch(`/api/events/${eventId}`);
        setEvent(await updated.json());
        setShowJoin(false);
      }
    } finally {
      setConfirming(false);
    }
  };

  const advance = async () => {
    const res = await fetch(`/api/events/${eventId}/advance`, { method: 'POST' });
    if (res.ok) {
      const updated = await fetch(`/api/events/${eventId}`);
      setEvent(await updated.json());
    }
  };

  const previousStep = async () => {
    const res = await fetch(`/api/events/${eventId}/previous`, { method: 'POST' });
    if (res.ok) {
      const updated = await fetch(`/api/events/${eventId}`);
      setEvent(await updated.json());
    }
  };

  const reorder = async (items: Array<{ id: string; position: number }>) => {
    if (!event) return;
    await fetch(`/api/events/${event.id}/queue`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const updated = await fetch(`/api/events/${event.id}`);
    setEvent(await updated.json());
  };

  const moveItem = async (eventProjectId: string, direction: 'up' | 'down') => {
    if (!event) return;
    const ordered = allOrdered;
    const movableStatuses = new Set(['QUEUED', 'APPROVED']);
    const index = ordered.findIndex(x => x.id === eventProjectId);
    if (index === -1) return;
    const current = ordered[index];
    if (!movableStatuses.has(current.status)) return;
    // Find neighbor in the given direction that is movable
    let neighborIndex = -1;
    if (direction === 'up') {
      for (let i = index - 1; i >= 0; i--) {
        if (movableStatuses.has(ordered[i].status)) { neighborIndex = i; break; }
      }
    } else {
      for (let i = index + 1; i < ordered.length; i++) {
        if (movableStatuses.has(ordered[i].status)) { neighborIndex = i; break; }
      }
    }
    if (neighborIndex === -1) return;
    const neighbor = ordered[neighborIndex];
    await reorder([
      { id: current.id, position: neighbor.position },
      { id: neighbor.id, position: current.position },
    ]);
  };

  const delistItem = async (eventProjectId: string) => {
    if (!event) return;
    if (event.isFinished) return;
    const res = await fetch(`/api/events/${event.id}/queue/${eventProjectId}`, { method: 'DELETE' });
    if (res.status === 204) {
      const updated = await fetch(`/api/events/${event.id}`);
      setEvent(await updated.json());
    }
  };

  // Likes
  const handleLike = async (
    e: React.MouseEvent,
    projectId: string,
    isLiked: boolean
  ) => {
    e.preventDefault();
    if (!userInfo) {
      alert("Please sign in to like projects");
      return;
    }
    try {
      const resp = await fetch(`/api/projects/${projectId}/like`, { method: isLiked ? 'DELETE' : 'POST' });
      if (!resp.ok) return;
      setEvent(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          projects: prev.projects.map(ep => {
            if (ep.project.id !== projectId) return ep;
            return {
              ...ep,
              project: {
                ...ep.project,
                likes: isLiked
                  ? ep.project.likes.filter(l => l.hackerId !== userInfo.id)
                  : [...ep.project.likes, { hackerId: userInfo.id, createdAt: new Date().toISOString() as any }],
              },
            };
          })
        };
      });
    } catch (err) {
      console.error('like error', err);
    }
  };

  if (loading) return <div className="py-24 text-center">Loading...</div>;
  if (!event) return <div className="py-24 text-center">Event not found</div>;

  // We render the same layout regardless of start state to keep UX consistent

  return (
    <>
    <div className={`min-h-screen ${isDarkMode ? "bg-black text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <StageBadge now={now} start={event.startTime} />
            <span className={`text-xs px-2 py-1 rounded ${isDarkMode ? "bg-gray-800 text-gray-300" : "bg-gray-200 text-gray-700"}`}>All times ET (Boston)</span>
            {event.isFinished && (
              <span className={`text-xs px-2 py-1 rounded ${isDarkMode ? "bg-red-700 text-white" : "bg-red-600 text-white"}`}>Finished</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {event.meetingUrl && (
              <a href={event.meetingUrl} target="_blank" className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm">Join meeting</a>
            )}
            {isController && (
              <>
                <button onClick={() => {
                  // Prefill edit state
                  setEditTitle(event.title || "");
                  setEditMeetingUrl(event.meetingUrl || "");
                  // Format to datetime-local
                  const toLocal = (iso?: string | null) => {
                    if (!iso) return "";
                    const d = new Date(iso);
                    const pad = (n: number) => String(n).padStart(2, "0");
                    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    // Note: displayed as user's local; label indicates ET
                  };
                  setEditStartTime(toLocal(event.startTime));
                  setSelectedMCs((event.mcs || []).map(m => m.hacker.id));
                  setShowEdit(true);
                }} className="px-3 py-2 rounded-md bg-gray-600 text-white text-sm">Edit event</button>
                {!event.isFinished && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/events/${event.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isFinished: true }),
                        });
                        if (res.ok) {
                          const updated = await res.json();
                          setEvent(updated);
                        }
                      } catch (e) {}
                    }}
                    className="px-3 py-2 rounded-md bg-red-600 text-white text-sm"
                  >
                    Mark finished
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <p className="opacity-80 mb-4">{event.description}</p>

        {
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className={`${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-xl p-4 shadow lg:col-span-2 order-2 lg:order-1`}>
              <h2 className="font-semibold mb-3">Current project</h2>
              {currentItem ? (
                <div className="max-w-5xl">
                  <div className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl border ${isDarkMode ? "border-gray-700" : "border-gray-200"} overflow-hidden`}>
                    {/* Preview image header */}
                    <div className="relative h-52 sm:h-64 w-full">
                      <NextImage
                        src={
                          currentItem.project.thumbnail?.url ||
                          (isDarkMode
                            ? "/images/default_project_thumbnail_dark.svg"
                            : "/images/default_project_thumbnail_light.svg")
                        }
                        alt={currentItem.project.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {/* Optional dark overlay for better title contrast if needed */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />
                    </div>
                    {/* Header: title + like */}
                    <div className="p-4 sm:p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link href={`/projects/${currentItem.project.id}`} target="_blank" rel="noopener noreferrer" className={`${isDarkMode ? "text-gray-100 hover:text-purple-400" : "text-gray-900 hover:text-indigo-600"} text-xl sm:text-2xl font-bold transition-colors`}>
                            {currentItem.project.title}
                          </Link>
                          <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                            Launched on {new Date(currentItem.project.startDate as any).toLocaleDateString()}
                          </p>
                        </div>
                        {(() => {
                          const liked = currentItem.project.likes.some(l => l.hackerId === userInfo?.id);
                          return (
                            <button
                              onClick={(e)=>handleLike(e, currentItem.project.id, liked)}
                              aria-label={`Likes ${currentItem.project.likes.length}`}
                              className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full hover:bg-white/30 transition-colors"
                              title="Like"
                            >
                              {liked ? (
                                <HeartIconSolid className="h-5 w-5 text-red-500" />
                              ) : (
                                <HeartIcon className={`h-5 w-5 ${isDarkMode ? "text-white" : "text-gray-700"}`} />
                              )}
                              <span className={`${isDarkMode ? "text-white" : "text-gray-800"} text-lg`}>{currentItem.project.likes.length}</span>
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    {/* Links */}
                    {(currentItem.project.demoUrl || currentItem.project.githubUrl || currentItem.project.blogUrl) && (
                      <div className="px-4 sm:px-6 py-4 flex flex-wrap gap-3">
                        {currentItem.project.demoUrl && (
                          <Link href={currentItem.project.demoUrl} target="_blank" className={`${isDarkMode ? "bg-indigo-700 hover:bg-indigo-600" : "bg-indigo-600 hover:bg-indigo-700"} text-white px-3 py-2 rounded-md text-sm`}>View Demo</Link>
                        )}
                        {currentItem.project.githubUrl && (
                          <Link href={currentItem.project.githubUrl} target="_blank" className={`${isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-800 hover:bg-gray-900 text-white"} px-3 py-2 rounded-md text-sm`}>GitHub</Link>
                        )}
                        {currentItem.project.blogUrl && (
                          <Link href={currentItem.project.blogUrl} target="_blank" className={`${isDarkMode ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-800 hover:bg-gray-900 text-white"} px-3 py-2 rounded-md text-sm`}>Blogpost</Link>
                        )}
                      </div>
                    )}
                    {/* Tags */}
                    <div className="px-4 sm:px-6 py-2 flex flex-wrap gap-2">
                      {currentItem.project.techTags?.map(tag => (
                        <span key={tag.id} className={`px-2 py-1 rounded-full text-xs ${isDarkMode ? "bg-purple-900/50 text-purple-300" : "bg-indigo-100 text-indigo-700"}`}>{tag.name}</span>
                      ))}
                      {currentItem.project.domainTags?.map(tag => (
                        <span key={tag.id} className={`px-2 py-1 rounded-full text-xs ${isDarkMode ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"}`}>{tag.name}</span>
                      ))}
                    </div>
                    {/* Description */}
                    <div className="px-4 sm:px-6 py-4">
                      <ReactMarkdown className={`${isDarkMode ? "prose prose-invert max-w-none" : "prose max-w-none"}`}>
                        {currentItem.project.description || currentItem.project.preview}
                      </ReactMarkdown>
                    </div>
                    {/* Team section */}
                    <div className="px-4 sm:px-6 pb-6">
                      <h3 className={`text-lg font-semibold mb-3 ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>Team</h3>
                      {/* Launch Lead */}
                      {currentItem.project.launchLead?.id && (
                        <div className="mb-4">
                          <h4 className={`text-xs font-semibold mb-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Launch Lead</h4>
                          <Link href={`/hacker/${currentItem.project.launchLead.id}`}>
                            <div className={`flex items-center p-3 rounded-lg transition-colors ${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-50 hover:bg-gray-100"}`}>
                              <div className="relative w-10 h-10">
                                <NextImage
                                  src={currentItem.project.launchLead.avatar?.url || "/images/default_avatar.png"}
                                  alt={currentItem.project.launchLead.name}
                                  width={40}
                                  height={40}
                                  className="rounded-full object-cover"
                                  unoptimized
                                />
                              </div>
                              <div className="ml-3">
                                <div className={`${isDarkMode ? "text-gray-100" : "text-gray-900"} text-sm font-medium`}>{currentItem.project.launchLead.name}</div>
                                <div className="text-xs text-indigo-500">Launch Lead</div>
                              </div>
                            </div>
                          </Link>
                        </div>
                      )}
                      {/* Participants */}
                      <div>
                        <h4 className={`text-xs font-semibold mb-2 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>Team Members</h4>
                        <div className="flex flex-col gap-2">
                          {currentItem.project.participants.map((participant) => (
                            <Link key={participant.hacker.id} href={`/hacker/${participant.hacker.id}`}>
                              <div className={`flex items-center p-2 rounded-lg transition-colors ${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-50 hover:bg-gray-100"}`}>
                                <div className="relative w-10 h-10">
                                  <NextImage
                                    src={participant.hacker.avatar?.url || "/images/default_avatar.png"}
                                    alt={participant.hacker.name}
                                    width={40}
                                    height={40}
                                    className="rounded-full object-cover"
                                    unoptimized
                                  />
                                </div>
                                <div className="ml-3">
                                  <div className={`${isDarkMode ? "text-gray-100" : "text-gray-900"} text-sm font-medium`}>{participant.hacker.name}</div>
                                  <div className={`text-xs ${isDarkMode ? "text-indigo-400" : "text-gray-600"}`}>{(participant.role === "hacker" ? "builder" : participant.role) || "builder"}</div>
                                </div>
                              </div>
                            </Link>
                          ))}
                          {currentItem.project.participants.length === 0 && (
                            <div className={`${isDarkMode ? "text-gray-400" : "text-gray-500"} text-sm`}>No additional members</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="opacity-70">No current project</div>
              )}
            </div>
            <div className="space-y-6 order-1 lg:order-2">
              <div className={`${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-xl p-4 shadow`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Presentation queue</h3>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                  {allOrdered.map((ep) => {
                    const isLiked = ep.project.likes.some(l => l.hackerId === userInfo?.id);
                    const isCurrent = ep.status === 'CURRENT';
                    const isPast = ep.status === 'DONE' || ep.status === 'SKIPPED';
                    // Compute relative index label: 0 for current, negatives for past, positives for future
                    const curIdx = allOrdered.findIndex(x => x.status === 'CURRENT');
                    let relLabel = '';
                    if (curIdx === -1) {
                      // If no current, count from first APPROVED/QUEUED as +1
                      const firstUpcoming = allOrdered.findIndex(x => x.status === 'APPROVED' || x.status === 'QUEUED');
                      if (firstUpcoming !== -1) {
                        const delta = (allOrdered.findIndex(x=>x.id===ep.id) - firstUpcoming) + 1;
                        relLabel = delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);
                      } else {
                        relLabel = `${allOrdered.findIndex(x=>x.id===ep.id) + 1}`;
                      }
                    } else {
                      const delta = allOrdered.findIndex(x=>x.id===ep.id) - curIdx;
                      if (delta === 0) relLabel = '0';
                      else relLabel = delta > 0 ? `+${delta}` : `${delta}`;
                    }
                    // Determine if up/down should be enabled
                    const movable = new Set(['QUEUED','APPROVED']);
                    const idx = allOrdered.findIndex(x=>x.id===ep.id);
                    let canUp = false, canDown = false;
                    if (movable.has(ep.status)) {
                      for (let i = idx - 1; i >= 0; i--) { if (movable.has(allOrdered[i].status)) { canUp = true; break; } }
                      for (let i = idx + 1; i < allOrdered.length; i++) { if (movable.has(allOrdered[i].status)) { canDown = true; break; } }
                    }
                    return (
                      <div
                        key={ep.id}
                        className={`group flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                          isCurrent
                            ? (isDarkMode ? 'border-indigo-500 bg-indigo-500/10' : 'border-indigo-300 bg-indigo-50')
                            : isDarkMode
                              ? 'border-gray-700 bg-gray-800/70 hover:bg-gray-800'
                              : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${isCurrent ? (isDarkMode ? 'bg-indigo-700 text-indigo-100' : 'bg-indigo-100 text-indigo-700') : (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700')}`}>{relLabel}</span>
                          <a
                            href={`/projects/${ep.project.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`truncate mr-3 text-sm font-medium ${isCurrent ? (isDarkMode ? 'text-indigo-200' : 'text-indigo-800') : (isDarkMode ? 'text-gray-100' : 'text-gray-900')} ${isPast ? 'opacity-70' : ''}`}
                            title={ep.project.title}
                          >
                            {ep.project.title}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          {isCurrent && (
                            <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white'}`}>Current</span>
                          )}
                          {isController && !event.isFinished && (
                            <div className="flex items-center gap-1 mr-1">
                              <button
                                disabled={!canUp}
                                onClick={() => moveItem(ep.id, 'up')}
                                className={`w-7 h-7 rounded-md text-xs ${canUp ? (isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200') : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                aria-label="Move up"
                              >▲</button>
                              <button
                                disabled={!canDown}
                                onClick={() => moveItem(ep.id, 'down')}
                                className={`w-7 h-7 rounded-md text-xs ${canDown ? (isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200') : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                aria-label="Move down"
                              >▼</button>
                              <button
                                onClick={() => delistItem(ep.id)}
                                className={`w-7 h-7 rounded-md text-xs ${isDarkMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                                aria-label="Delist"
                                title="Remove from queue"
                              >✕</button>
                            </div>
                          )}
                          {!isController && !event.isFinished && userInfo?.id === (ep as any).addedById && (
                            <div className="flex items-center gap-1 mr-1">
                              <button
                                onClick={() => delistItem(ep.id)}
                                className={`w-7 h-7 rounded-md text-xs ${isDarkMode ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-red-600 text-white hover:bg-red-700'}`}
                                aria-label="Delist"
                                title="Remove from queue"
                              >✕</button>
                              {/* Owner can move own item within movable range */}
                              {movable.has(ep.status) && (
                                <>
                                  <button
                                    disabled={!canUp}
                                    onClick={() => moveItem(ep.id, 'up')}
                                    className={`w-7 h-7 rounded-md text-xs ${canUp ? (isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200') : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                    aria-label="Move up"
                                  >▲</button>
                                  <button
                                    disabled={!canDown}
                                    onClick={() => moveItem(ep.id, 'down')}
                                    className={`w-7 h-7 rounded-md text-xs ${canDown ? (isDarkMode ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200') : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                    aria-label="Move down"
                                  >▼</button>
                                </>
                              )}
                            </div>
                          )}
                          <button
                            onClick={(e)=> handleLike(e, ep.project.id, isLiked)}
                            className={`px-2 h-7 rounded-md text-xs font-semibold flex items-center gap-1 ${isLiked ? 'bg-red-500 text-white' : (isDarkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800')}`}
                            aria-label={`Like ${ep.project.title}`}
                          >
                            <span>❤</span>
                            <span>{ep.project.likes.length}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button onClick={openJoin} disabled={event.isFinished} className={`w-full px-3 py-2 rounded-md text-white text-sm ${event.isFinished ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600'}`}>{event.isFinished ? 'Queue locked' : 'Join queue'}</button>
                  {(isAdmin || (event?.mcs || []).some(m=>m.hacker.id===userInfo?.id)) && (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={previousStep} className="w-full px-3 py-2 rounded-md bg-gray-600 text-white text-sm">Previous</button>
                      <button onClick={advance} className="w-full px-3 py-2 rounded-md bg-purple-600 text-white text-sm">Move next</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
    {showEdit && event && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl w-full max-w-lg p-6 shadow-xl`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Edit Event</h2>
            <button onClick={() => setShowEdit(false)} className="text-sm opacity-70">Close</button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Title</label>
              <input value={editTitle} onChange={(e)=>setEditTitle(e.target.value)} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
            </div>
            <div>
              <label className="block text-sm mb-1">Meeting link</label>
              <input value={editMeetingUrl} onChange={(e)=>setEditMeetingUrl(e.target.value)} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} placeholder="https://zoom.us/j/…" />
            </div>
            <div>
              <label className="block text-sm mb-1">Start time</label>
              <input type="datetime-local" value={editStartTime} onChange={(e)=>setEditStartTime(e.target.value)} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
              <p className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>All times are ET (Boston)</p>
            </div>
            <div>
              <label className="block text-sm mb-2">MCs</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(allHackers.filter(h=>selectedMCs.includes(h.id))).map(h=> (
                  <span key={h.id} className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} px-2 py-1 rounded-full text-sm`}>{h.name}</span>
                ))}
                {selectedMCs.length === 0 && <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No MCs selected</span>}
              </div>
              <button onClick={()=>setShowMCSelector(true)} className="px-3 py-2 rounded-md bg-gray-200 text-gray-900 text-sm">
                Edit MC list
              </button>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={()=>setShowEdit(false)} className={`${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'} px-4 py-2 rounded-md`}>Cancel</button>
            <button
              onClick={async ()=> {
                try {
                  const body: any = {
                    title: editTitle,
                    meetingUrl: editMeetingUrl || null,
                    startTime: editStartTime ? new Date(editStartTime).toISOString() : undefined,
                    mcIds: selectedMCs,
                  };
                  const res = await fetch(`/api/events/${event.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  });
                  if (!res.ok) {
                    alert("Failed to update event");
                    return;
                  }
                  const updated = await res.json();
                  setEvent(updated);
                  setShowEdit(false);
                } catch {}
              }}
              className={`px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    )}
    <HackerSelector
      showModal={showMCSelector}
      setShowModal={setShowMCSelector}
      isDarkMode={isDarkMode}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      filteredHackers={allHackers.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()) || (h.email || "").toLowerCase().includes(searchTerm.toLowerCase()))}
      title="Select MCs"
      singleSelect={false}
      selectedIds={selectedMCs}
      showRoleSelector={false}
      handleAddMember={(h)=> setSelectedMCs(prev => prev.includes(h.id) ? prev.filter(id=>id!==h.id) : [...prev, h.id])}
    />
    {showJoin && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className={`${isDarkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl w-full max-w-lg p-6 shadow-xl`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Choose your project</h2>
            <button onClick={()=>setShowJoin(false)} className="text-sm opacity-70">Close</button>
          </div>
          {myProjects.length === 0 ? (
            <div className="opacity-80">You have no projects to pitch.</div>
          ) : (
            <>
              <div className="mb-3">
                <input
                  value={searchTerm}
                  onChange={(e)=>setSearchTerm(e.target.value)}
                  placeholder="Search your projects..."
                  className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-900'}`}
                />
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {filteredMyProjects.map(p => (
                  <label key={p.id} className={`flex items-start gap-3 p-3 rounded-md border ${isDarkMode ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                    <input type="radio" name="proj" value={p.id} checked={selectedProjectId===p.id} onChange={()=>setSelectedProjectId(p.id)} className="mt-1" />
                    <div className="min-w-0">
                      <div className="font-medium truncate" title={p.title}>{p.title}</div>
                      <div className="text-xs opacity-70 truncate">{p.preview}</div>
                      <div className="text-[10px] opacity-60 mt-1">Launched {new Date((p as any).startDate).toLocaleDateString()}</div>
                    </div>
                  </label>
                ))}
                {filteredMyProjects.length === 0 && (
                  <div className="text-sm opacity-70">No results</div>
                )}
              </div>
            </>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={()=>setShowJoin(false)} className={`${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'} px-4 py-2 rounded-md`}>Cancel</button>
            <button disabled={!selectedProjectId || confirming} onClick={confirmJoin} className={`px-4 py-2 rounded-md ${confirming ? 'bg-gray-400' : 'bg-green-600'} text-white`}>{confirming ? 'Adding...' : 'Confirm'}</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
