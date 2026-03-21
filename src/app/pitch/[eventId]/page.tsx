"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";
import { Project, ProjectCard } from "../../components/Project";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import ReactMarkdown from "react-markdown";

type EventDetail = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  meetingUrl?: string | null;
  audienceCanReorder: boolean;
  phase: "VOTING" | "PITCHING";
  mcs: Array<{ id: string; hacker: { id: string; name: string } }>;
  projects: Array<{
    id: string;
    position: number;
    status: "QUEUED" | "APPROVED" | "CURRENT" | "DONE" | "SKIPPED";
    approved: boolean;
    addedById: string;
    project: Project;
  }>;
};

function StageBadge({ phase }: { phase: "VOTING" | "PITCHING" }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${phase === "VOTING" ? "bg-yellow-200 text-yellow-800" : "bg-green-200 text-green-800"}`}>
      {phase === "VOTING" ? "Voting Open" : "Pitching"}
    </span>
  );
}

// ── Swipe Card ──────────────────────────────────────────
function SwipeCard({
  project,
  onSwipeRight,
  onSwipeLeft,
  isDarkMode,
}: {
  project: Project;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  isDarkMode: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const SWIPE_THRESHOLD = 100;

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipeRight();
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipeLeft();
    }
    setDragX(0);
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDrag={(_, info) => setDragX(info.offset.x)}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: dragX > 0 ? 300 : -300, opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative cursor-grab active:cursor-grabbing select-none"
    >
      {/* Swipe overlay */}
      {dragX !== 0 && (
        <div
          className={`absolute inset-0 rounded-xl z-10 pointer-events-none flex items-center justify-center text-4xl font-bold transition-opacity ${
            dragX > 0
              ? "bg-green-500/20 text-green-500"
              : "bg-red-500/20 text-red-500"
          }`}
          style={{ opacity: Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1) * 0.8 }}
        >
          {dragX > 0 ? "👍" : "👎"}
        </div>
      )}
      <div className={`${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-xl p-6 shadow-lg max-h-[70vh] overflow-y-auto`}>
        <img
          src={project.thumbnail?.url || (isDarkMode ? "/images/default_project_thumbnail_dark.svg" : "/images/default_project_thumbnail_light.svg")}
          alt={project.title}
          className="w-full max-h-[30vh] object-cover rounded-lg mb-4"
          draggable={false}
        />
        <h3 className="text-xl font-bold mb-2">{project.title}</h3>
        {project.preview && <p className="opacity-80 mb-2">{project.preview}</p>}
        {project.description && (
          <div className={`text-sm mb-3 ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
            <ReactMarkdown
              className={`prose prose-sm max-w-none ${
                isDarkMode
                  ? "prose-invert prose-pre:bg-gray-800 prose-a:text-indigo-400"
                  : "prose-gray prose-pre:bg-gray-100 prose-a:text-indigo-600"
              }`}
            >
              {project.description}
            </ReactMarkdown>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-3">
          {project.techTags?.slice(0, 5).map(tag => (
            <span key={tag.id} className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? "bg-gray-700" : "bg-gray-100"}`}>
              {tag.name}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm opacity-70">
            <span>by {project.launchLead.name}</span>
            {project.participants.length > 0 && (
              <span>+ {project.participants.length} others</span>
            )}
          </div>
          <a
            href={`/projects/${project.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm font-medium ${isDarkMode ? "text-indigo-400 hover:text-indigo-300" : "text-indigo-600 hover:text-indigo-700"}`}
          >
            View project &rarr;
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ── Voting Phase ────────────────────────────────────────
function VotingPhase({
  event,
  setEvent,
  isDarkMode,
  userInfo,
  isAdmin,
  isController,
  openJoin,
}: {
  event: EventDetail;
  setEvent: (e: EventDetail | null) => void;
  isDarkMode: boolean;
  userInfo: any;
  isAdmin: boolean;
  isController: boolean;
  openJoin: () => void;
}) {
  const [votingStarted, setVotingStarted] = useState(false);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [transitioning, setTransitioning] = useState(false);

  // Projects to vote on: exclude user's own (auto-liked on backend) and already seen
  const deck = useMemo(() => {
    if (!userInfo) return [];
    return event.projects.filter(ep => {
      if (ep.addedById === userInfo.id) return false;
      if (seenIds.has(ep.project.id)) return false;
      return true;
    });
  }, [event.projects, userInfo, seenIds]);

  const currentCard = deck[0] ?? null;

  const handleSwipeRight = useCallback(async () => {
    if (!currentCard) return;
    setSeenIds(prev => new Set(prev).add(currentCard.project.id));
    try {
      await fetch(`/api/projects/${currentCard.project.id}/like`, { method: "POST" });
    } catch (err) {
      console.error("like error", err);
    }
  }, [currentCard]);

  const handleSwipeLeft = useCallback(() => {
    if (!currentCard) return;
    setSeenIds(prev => new Set(prev).add(currentCard.project.id));
  }, [currentCard]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!votingStarted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleSwipeRight();
      else if (e.key === "ArrowLeft") handleSwipeLeft();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [votingStarted, handleSwipeRight, handleSwipeLeft]);

  const endVoting = async () => {
    setTransitioning(true);
    try {
      const res = await fetch(`/api/events/${event.id}/transition`, { method: "POST" });
      if (res.ok) {
        const updated = await fetch(`/api/events/${event.id}`);
        setEvent(await updated.json());
      }
    } finally {
      setTransitioning(false);
    }
  };

  if (!votingStarted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-6">
        <h2 className="text-2xl font-bold">Welcome to {event.title}</h2>
        <p className="opacity-80 text-center max-w-md">
          Add your project to the pitch queue, then vote on other projects by swiping!
        </p>
        <div className="flex gap-4">
          <button
            onClick={openJoin}
            className="px-6 py-3 rounded-lg bg-green-600 text-white text-lg hover:bg-green-700"
          >
            Add Project
          </button>
          <button
            onClick={() => setVotingStarted(true)}
            className="px-6 py-3 rounded-lg bg-indigo-600 text-white text-lg hover:bg-indigo-700"
          >
            Start Voting
          </button>
        </div>
        <p className="text-sm opacity-60">{event.projects.length} project{event.projects.length !== 1 ? "s" : ""} submitted</p>
        {isController && (
          <div className="mt-4 border-t pt-4 w-full max-w-md">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-70">{event.projects.length} submissions</span>
              <button
                onClick={endVoting}
                disabled={transitioning}
                className={`px-4 py-2 rounded-md text-white ${transitioning ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"}`}
              >
                {transitioning ? "Ending..." : "End Voting"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-8">
      {isController && (
        <div className="w-full max-w-3xl mb-6 flex items-center justify-between">
          <span className="text-sm opacity-70">{event.projects.length} submissions</span>
          <div className="flex gap-2">
            <button
              onClick={endVoting}
              disabled={transitioning}
              className={`px-3 py-2 rounded-md text-white text-sm ${transitioning ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"}`}
            >
              {transitioning ? "Ending..." : "End Voting"}
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl" style={{ minHeight: 300 }}>
        <AnimatePresence mode="wait">
          {currentCard ? (
            <SwipeCard
              key={currentCard.project.id}
              project={currentCard.project}
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              isDarkMode={isDarkMode}
            />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-lg opacity-70">All caught up! Waiting for more projects...</p>
              <p className="text-sm opacity-50 mt-2">New projects will appear automatically — no need to refresh.</p>
              <button
                onClick={openJoin}
                className="mt-4 px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
              >
                Add Another Project
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {currentCard && (
        <div className="flex gap-6 mt-6">
          <button
            onClick={handleSwipeLeft}
            className="w-14 h-14 rounded-full bg-red-100 text-red-600 text-2xl flex items-center justify-center hover:bg-red-200"
            aria-label="Skip"
          >
            ✕
          </button>
          <button
            onClick={handleSwipeRight}
            className="w-14 h-14 rounded-full bg-green-100 text-green-600 text-2xl flex items-center justify-center hover:bg-green-200"
            aria-label="Like"
          >
            ❤
          </button>
        </div>
      )}

    </div>
  );
}

// ── Pitching Phase (existing presentation UI) ───────────
function PitchingPhase({
  event,
  setEvent,
  isDarkMode,
  userInfo,
  isAdmin,
  isController,
  openJoin,
}: {
  event: EventDetail;
  setEvent: (e: EventDetail | null) => void;
  isDarkMode: boolean;
  userInfo: any;
  isAdmin: boolean;
  isController: boolean;
  openJoin: () => void;
}) {
  const currentItem = useMemo(() => event.projects.find(p => p.status === "CURRENT"), [event]);
  const allOrdered = useMemo(
    () => [...event.projects].sort((a, b) => a.position - b.position),
    [event]
  );

  // Compute top-group
  const { topGroupIds, topGroupPositions } = useMemo(() => {
    const likeCounts = allOrdered.map(ep => ep.project.likes.length).sort((a, b) => b - a);
    const threshold = likeCounts.length >= 5 ? likeCounts[4] : -1;
    const ids = new Set(
      allOrdered
        .filter(ep => threshold >= 0 && ep.project.likes.length >= threshold)
        .map(ep => ep.id)
    );
    const positions = new Set(
      allOrdered
        .filter(ep => ids.has(ep.id))
        .map(ep => ep.position)
    );
    return { topGroupIds: ids, topGroupPositions: positions };
  }, [allOrdered]);

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
      const resp = await fetch(`/api/projects/${projectId}/like`, { method: isLiked ? "DELETE" : "POST" });
      if (!resp.ok) return;
      setEvent({
        ...event,
        projects: event.projects.map(ep => {
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
        }),
      });
    } catch (err) {
      console.error("like error", err);
    }
  };

  const advance = async () => {
    const res = await fetch(`/api/events/${event.id}/advance`, { method: "POST" });
    if (res.ok) {
      const updated = await fetch(`/api/events/${event.id}`);
      setEvent(await updated.json());
    }
  };

  const previousStep = async () => {
    const res = await fetch(`/api/events/${event.id}/previous`, { method: "POST" });
    if (res.ok) {
      const updated = await fetch(`/api/events/${event.id}`);
      setEvent(await updated.json());
    }
  };

  const reorder = async (items: Array<{ id: string; position: number }>) => {
    await fetch(`/api/events/${event.id}/queue`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const updated = await fetch(`/api/events/${event.id}`);
    setEvent(await updated.json());
  };

  const moveItem = async (eventProjectId: string, direction: "up" | "down") => {
    const ordered = allOrdered;
    const movableStatuses = new Set(["QUEUED", "APPROVED"]);
    const index = ordered.findIndex(x => x.id === eventProjectId);
    if (index === -1) return;
    const current = ordered[index];
    if (!movableStatuses.has(current.status)) return;
    // Cannot move top-group projects
    if (topGroupIds.has(current.id)) return;

    let neighborIndex = -1;
    if (direction === "up") {
      for (let i = index - 1; i >= 0; i--) {
        if (movableStatuses.has(ordered[i].status) && !topGroupIds.has(ordered[i].id)) {
          neighborIndex = i;
          break;
        }
      }
    } else {
      for (let i = index + 1; i < ordered.length; i++) {
        if (movableStatuses.has(ordered[i].status) && !topGroupIds.has(ordered[i].id)) {
          neighborIndex = i;
          break;
        }
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
    const res = await fetch(`/api/events/${event.id}/queue/${eventProjectId}`, { method: "DELETE" });
    if (res.status === 204) {
      const updated = await fetch(`/api/events/${event.id}`);
      setEvent(await updated.json());
    }
  };

  // Find first non-top item index for the divider
  const firstNonTopIndex = allOrdered.findIndex(ep => !topGroupIds.has(ep.id));
  const hasTopGroup = topGroupIds.size > 0;

  return (
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
            {allOrdered.map((ep, idx) => {
              const isLiked = ep.project.likes.some(l => l.hackerId === userInfo?.id);
              const isCurrent = ep.status === "CURRENT";
              const isPast = ep.status === "DONE" || ep.status === "SKIPPED";
              const isTopGroup = topGroupIds.has(ep.id);

              // Compute relative index label
              const curIdx = allOrdered.findIndex(x => x.status === "CURRENT");
              let relLabel = "";
              if (curIdx === -1) {
                const firstUpcoming = allOrdered.findIndex(x => x.status === "APPROVED" || x.status === "QUEUED");
                if (firstUpcoming !== -1) {
                  const delta = idx - firstUpcoming + 1;
                  relLabel = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`;
                } else {
                  relLabel = `${idx + 1}`;
                }
              } else {
                const delta = idx - curIdx;
                relLabel = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`;
              }

              // Determine if up/down should be enabled
              const movable = new Set(["QUEUED", "APPROVED"]);
              let canUp = false,
                canDown = false;
              if (movable.has(ep.status) && !isTopGroup) {
                for (let i = idx - 1; i >= 0; i--) {
                  if (movable.has(allOrdered[i].status) && !topGroupIds.has(allOrdered[i].id)) {
                    canUp = true;
                    break;
                  }
                }
                for (let i = idx + 1; i < allOrdered.length; i++) {
                  if (movable.has(allOrdered[i].status) && !topGroupIds.has(allOrdered[i].id)) {
                    canDown = true;
                    break;
                  }
                }
              }

              // Insert "Top Projects" divider before first non-top item
              const showDivider = hasTopGroup && idx === firstNonTopIndex;

              return (
                <div key={ep.id}>
                  {showDivider && (
                    <div className="flex items-center gap-2 py-2">
                      <div className={`flex-1 h-px ${isDarkMode ? "bg-yellow-500/40" : "bg-yellow-400"}`} />
                      <span className="text-xs font-semibold text-yellow-600 uppercase tracking-wider">
                        Top Projects
                      </span>
                      <div className={`flex-1 h-px ${isDarkMode ? "bg-yellow-500/40" : "bg-yellow-400"}`} />
                    </div>
                  )}
                  <div
                    className={`group flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                      isCurrent
                        ? isDarkMode
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-indigo-300 bg-indigo-50"
                        : isTopGroup
                        ? isDarkMode
                          ? "border-yellow-600/40 bg-yellow-900/10"
                          : "border-yellow-300 bg-yellow-50"
                        : isDarkMode
                        ? "border-gray-700 bg-gray-800/70 hover:bg-gray-800"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          isCurrent
                            ? isDarkMode
                              ? "bg-indigo-700 text-indigo-100"
                              : "bg-indigo-100 text-indigo-700"
                            : isDarkMode
                            ? "bg-gray-700 text-gray-300"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {relLabel}
                      </span>
                      <a
                        href={`/projects/${ep.project.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`truncate mr-3 text-sm font-medium ${
                          isCurrent
                            ? isDarkMode
                              ? "text-indigo-200"
                              : "text-indigo-800"
                            : isDarkMode
                            ? "text-gray-100"
                            : "text-gray-900"
                        } ${isPast ? "opacity-70" : ""}`}
                        title={ep.project.title}
                      >
                        {ep.project.title}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCurrent && (
                        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-indigo-600 text-white">
                          Current
                        </span>
                      )}
                      {isTopGroup && !isCurrent && (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-600">
                          Top
                        </span>
                      )}
                      {isController && !isTopGroup && (
                        <div className="flex items-center gap-1 mr-1">
                          <button
                            disabled={!canUp}
                            onClick={() => moveItem(ep.id, "up")}
                            className={`w-7 h-7 rounded-md text-xs ${
                              canUp
                                ? isDarkMode
                                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                            aria-label="Move up"
                          >
                            ▲
                          </button>
                          <button
                            disabled={!canDown}
                            onClick={() => moveItem(ep.id, "down")}
                            className={`w-7 h-7 rounded-md text-xs ${
                              canDown
                                ? isDarkMode
                                  ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                                  : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                            aria-label="Move down"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => delistItem(ep.id)}
                            className="w-7 h-7 rounded-md text-xs bg-red-600 text-white hover:bg-red-700"
                            aria-label="Delist"
                            title="Remove from queue"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {!isController && userInfo?.id === ep.addedById && !isTopGroup && (
                        <div className="flex items-center gap-1 mr-1">
                          <button
                            onClick={() => delistItem(ep.id)}
                            className="w-7 h-7 rounded-md text-xs bg-red-600 text-white hover:bg-red-700"
                            aria-label="Delist"
                            title="Remove from queue"
                          >
                            ✕
                          </button>
                          {movable.has(ep.status) && (
                            <>
                              <button
                                disabled={!canUp}
                                onClick={() => moveItem(ep.id, "up")}
                                className={`w-7 h-7 rounded-md text-xs ${
                                  canUp
                                    ? isDarkMode
                                      ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                }`}
                                aria-label="Move up"
                              >
                                ▲
                              </button>
                              <button
                                disabled={!canDown}
                                onClick={() => moveItem(ep.id, "down")}
                                className={`w-7 h-7 rounded-md text-xs ${
                                  canDown
                                    ? isDarkMode
                                      ? "bg-gray-700 text-gray-200 hover:bg-gray-600"
                                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                }`}
                                aria-label="Move down"
                              >
                                ▼
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      <button
                        onClick={e => handleLike(e, ep.project.id, isLiked)}
                        className={`px-2 h-7 rounded-md text-xs font-semibold flex items-center gap-1 ${
                          isLiked
                            ? "bg-red-500 text-white"
                            : isDarkMode
                            ? "bg-gray-700 text-gray-200"
                            : "bg-gray-100 text-gray-800"
                        }`}
                        aria-label={`Like ${ep.project.title}`}
                      >
                        <span>❤</span>
                        <span>{ep.project.likes.length}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={openJoin} className="w-full px-3 py-2 rounded-md bg-green-600 text-white text-sm">
              Add Project
            </button>
            {isController && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={previousStep} className="w-full px-3 py-2 rounded-md bg-gray-600 text-white text-sm">
                  Previous
                </button>
                <button onClick={advance} className="w-full px-3 py-2 rounded-md bg-purple-600 text-white text-sm">
                  Move next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────
export default function PitchEventPage() {
  const { isDarkMode } = useTheme();
  const { isAdmin, userInfo } = useUserContext();
  const params = useParams();
  const eventId = params?.eventId as string;
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Join modal state
  const [showJoin, setShowJoin] = useState(false);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
    if (eventId) {
      const handle = setInterval(load, 4000);
      return () => clearInterval(handle);
    }
  }, [eventId]);

  const isController = useMemo(
    () => isAdmin || (event?.mcs || []).some(m => m.hacker.id === userInfo?.id),
    [isAdmin, event?.mcs, userInfo?.id]
  );

  const openJoin = async () => {
    if (!userInfo) return alert("Sign in first");
    const my = await fetch("/api/projects?status=APPROVED");
    const all = await my.json();
    const mine = all.filter(
      (p: Project) =>
        p.launchLead.id === userInfo.id ||
        p.participants.some(pt => pt.hacker.id === userInfo.id)
    );
    const sorted = [...mine].sort((a: any, b: any) => {
      const da = new Date(a.startDate).getTime();
      const db = new Date(b.startDate).getTime();
      return isNaN(db) || isNaN(da) ? 0 : db - da;
    });
    setMyProjects(sorted);
    setSelectedProjectId(sorted[0]?.id || "");
    setShowJoin(true);
  };

  const filteredMyProjects = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return myProjects;
    return myProjects.filter(
      p =>
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

  if (loading) return <div className="py-24 text-center">Loading...</div>;
  if (!event) return <div className="py-24 text-center">Event not found</div>;

  return (
    <>
      <div className={`min-h-screen ${isDarkMode ? "bg-black text-gray-100" : "bg-gray-50 text-gray-900"}`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{event.title}</h1>
              <StageBadge phase={event.phase} />
            </div>
            <div className="flex items-center gap-2">
              {event.meetingUrl && (
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm"
                >
                  Join meeting
                </a>
              )}
            </div>
          </div>

          <p className="opacity-80 mb-4">{event.description}</p>

          {event.phase === "VOTING" ? (
            <VotingPhase
              event={event}
              setEvent={setEvent}
              isDarkMode={isDarkMode}
              userInfo={userInfo}
              isAdmin={isAdmin}
              isController={isController}
              openJoin={openJoin}
            />
          ) : (
            <PitchingPhase
              event={event}
              setEvent={setEvent}
              isDarkMode={isDarkMode}
              userInfo={userInfo}
              isAdmin={isAdmin}
              isController={isController}
              openJoin={openJoin}
            />
          )}
        </div>
      </div>

      {showJoin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`${isDarkMode ? "bg-gray-900" : "bg-white"} rounded-xl w-full max-w-lg p-6 shadow-xl`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Choose your project</h2>
              <button onClick={() => setShowJoin(false)} className="text-sm opacity-70">
                Close
              </button>
            </div>
            {myProjects.length === 0 ? (
              <div className="opacity-80">You have no projects to pitch.</div>
            ) : (
              <>
                <div className="mb-3">
                  <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search your projects..."
                    className={`w-full px-3 py-2 rounded-md ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-gray-100 text-gray-900"}`}
                  />
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {filteredMyProjects.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 p-3 rounded-md border ${
                        isDarkMode
                          ? "bg-gray-800 border-gray-700 hover:bg-gray-750"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="proj"
                        value={p.id}
                        checked={selectedProjectId === p.id}
                        onChange={() => setSelectedProjectId(p.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0">
                        <div className="font-medium truncate" title={p.title}>
                          {p.title}
                        </div>
                        <div className="text-xs opacity-70 truncate">{p.preview}</div>
                        <div className="text-[10px] opacity-60 mt-1">
                          Launched {new Date((p as any).startDate).toLocaleDateString()}
                        </div>
                      </div>
                    </label>
                  ))}
                  {filteredMyProjects.length === 0 && <div className="text-sm opacity-70">No results</div>}
                </div>
              </>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowJoin(false)}
                className={`${isDarkMode ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800"} px-4 py-2 rounded-md`}
              >
                Cancel
              </button>
              <button
                disabled={!selectedProjectId || confirming}
                onClick={confirmJoin}
                className={`px-4 py-2 rounded-md ${confirming ? "bg-gray-400" : "bg-green-600"} text-white`}
              >
                {confirming ? "Adding..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
