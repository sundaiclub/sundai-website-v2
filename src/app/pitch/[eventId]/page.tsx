"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";
import { Project, ProjectCard } from "../../components/Project";
import { HackerSelector, type Hacker } from "../../components/HackerSelector";

type EventDetail = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  meetingUrl?: string | null;
  audienceCanReorder: boolean;
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
  const [poll, setPoll] = useState<NodeJS.Timeout | null>(null);

  // Join modal state
  const [showJoin, setShowJoin] = useState(false);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
      const handle = setInterval(load, 4000);
      setPoll(handle as any);
      return () => clearInterval(handle);
    }
  }, [eventId]);

  const currentItem = useMemo(() => event?.projects.find(p => p.status === "CURRENT"), [event]);
  const upcoming = useMemo(() => (event?.projects || []).filter(p => p.status === "QUEUED" || p.status === "APPROVED").sort((a,b)=>a.position-b.position), [event]);
  const previous = useMemo(() => (event?.projects || []).filter(p => p.status === "DONE" || p.status === "SKIPPED"), [event]);
  const allOrdered = useMemo(() => (event?.projects || []).slice().sort((a,b)=>a.position-b.position), [event]);
  const isController = useMemo(() => (isAdmin || (event?.mcs || []).some(m=>m.hacker.id===userInfo?.id)) , [isAdmin, event?.mcs, userInfo?.id]);

  const openJoin = async () => {
    if (!userInfo) return alert("Sign in first");
    const my = await fetch("/api/projects?status=APPROVED");
    const all = await my.json();
    const mine = all.filter((p: Project) => p.launchLead.id === userInfo.id || p.participants.some(pt => pt.hacker.id === userInfo.id));
    setMyProjects(mine);
    setSelectedProjectId(mine[0]?.id || "");
    setShowJoin(true);
  };

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

  const notStarted = now < new Date(event.startTime).getTime();

  return (
    <>
    <div className={`min-h-screen ${isDarkMode ? "bg-black text-gray-100" : "bg-gray-50 text-gray-900"}`}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <StageBadge now={now} start={event.startTime} />
          </div>
          <div className="flex items-center gap-2">
            {event.meetingUrl && (
              <a href={event.meetingUrl} target="_blank" className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm">Join meeting</a>
            )}
          </div>
        </div>

        <p className="opacity-80 mb-4">{event.description}</p>

        {notStarted ? (
              <div className={`${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-xl p-4 shadow mb-6`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold mb-1">Countdown to start</div>
                {/* Reuse logic from /pitch page for brevity */}
                <div>{new Date(event.startTime).toLocaleString()}</div>
              </div>
                  <button onClick={openJoin} className="px-4 py-2 rounded-md bg-green-600 text-white">Join queue</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className={`${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-xl p-4 shadow lg:col-span-2`}>
              <h2 className="font-semibold mb-3">Current project</h2>
              {currentItem ? (
                <div className="max-w-5xl">
                  <ProjectCard
                    project={currentItem.project}
                    userInfo={userInfo}
                    handleLike={handleLike}
                    isDarkMode={isDarkMode}
                    show_status={false}
                    show_team={true}
                    isAdmin={isAdmin}
                    variant="default"
                    openInNewTab={true}
                  />
                </div>
              ) : (
                <div className="opacity-70">No current project</div>
              )}
            </div>
            <div className="space-y-6">
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
                          {isController && (
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
                  <button onClick={openJoin} className="w-full px-3 py-2 rounded-md bg-green-600 text-white text-sm">Join queue</button>
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
        )}
      </div>
    </div>
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
            <div className="space-y-3">
              {myProjects.map(p => (
                <label key={p.id} className={`flex items-center gap-3 p-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <input type="radio" name="proj" value={p.id} checked={selectedProjectId===p.id} onChange={()=>setSelectedProjectId(p.id)} />
                  <div>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-sm opacity-75">{p.preview}</div>
                  </div>
                </label>
              ))}
            </div>
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
