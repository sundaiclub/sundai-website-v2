"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";
import { Project, ProjectCard } from "../../components/Project";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import ReactMarkdown from "react-markdown";

type PitchPhase = "WAITING" | "PRESENTING" | "QUESTIONS" | "COMPLETED";
type EventPhase = "VOTING" | "PITCHING" | "FINISHED";

type EventProjectEntry = {
  id: string;
  position: number;
  status: "QUEUED" | "APPROVED" | "CURRENT" | "DONE" | "SKIPPED";
  approved: boolean;
  addedById: string;
  project: Project;
  pitchPhase: PitchPhase;
  presentingStartedAt: string | null;
  questionsStartedAt: string | null;
  completedAt: string | null;
  allottedPresentingSec: number | null;
  allottedQuestionsSec: number | null;
};

type EventDetail = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  meetingUrl?: string | null;
  audienceCanReorder: boolean;
  phase: EventPhase;
  mcs: Array<{ id: string; hacker: { id: string; name: string } }>;
  projects: EventProjectEntry[];
};

function getStageBadgeStyles(phase: EventPhase) {
  if (phase === "VOTING") return "bg-indigo-100 text-indigo-700";
  if (phase === "PITCHING") return "bg-purple-100 text-purple-700";
  return "bg-gray-200 text-gray-700";
}

function getStageBadgeLabel(phase: EventPhase) {
  if (phase === "VOTING") return "Voting Open";
  if (phase === "PITCHING") return "Pitching";
  return "Finished";
}

function getPhaseActionLabel(targetPhase: EventPhase, currentPhase: EventPhase) {
  if (targetPhase === "PITCHING" && currentPhase === "FINISHED") return "Back to Presenting";
  if (targetPhase === "PITCHING") return "Move to Presenting";
  if (targetPhase === "VOTING") return "Move to Voting";
  if (currentPhase === "PITCHING") return "Finish Event";
  return "Move to Finished";
}

function StageBadge({ phase }: { phase: EventPhase }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${getStageBadgeStyles(phase)}`}>
      {getStageBadgeLabel(phase)}
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
              ? "bg-indigo-500/20 text-indigo-400"
              : "bg-gray-500/20 text-gray-400"
          }`}
          style={{ opacity: Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1) * 0.8 }}
        >
          {dragX > 0 ? "👍" : "👎"}
        </div>
      )}
      <div className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl p-6 shadow-lg max-h-[70vh] overflow-y-auto`}>
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
      const res = await fetch(`/api/events/${event.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhase: "PITCHING" }),
      });
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
      <div className={`grid grid-cols-1 gap-6 ${isController ? "lg:grid-cols-3" : ""}`}>
        <div className={`${isController ? "lg:col-span-2" : "max-w-3xl mx-auto"} flex flex-col items-center justify-center py-16 gap-6 w-full`}>
          <h2 className="text-2xl font-bold">Welcome to {event.title}</h2>
          <p className="opacity-80 text-center max-w-md">
            Add your project to the pitch queue, then vote on other projects by swiping!
          </p>
          <div className="flex gap-4">
            <button
              onClick={openJoin}
              className="px-3 py-1.5 rounded bg-indigo-600 text-white text-lg hover:bg-indigo-700 transition duration-300"
            >
              Add Project
            </button>
            <button
              onClick={() => setVotingStarted(true)}
              className="px-3 py-1.5 rounded bg-purple-600 text-white text-lg hover:bg-purple-700 transition duration-300"
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
                  className={`px-3 py-1.5 rounded text-white transition duration-300 ${transitioning ? "bg-gray-400" : "bg-gray-600 hover:bg-gray-700"}`}
                >
                  {transitioning ? "Ending..." : "End Voting"}
                </button>
              </div>
            </div>
          )}
        </div>
        {isController && (
          <div className="space-y-6">
            <VotingQueuePanel event={event} isDarkMode={isDarkMode} isController={isController} setEvent={setEvent} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-6 py-8 ${isController ? "lg:grid-cols-3" : ""}`}>
      <div className={`${isController ? "lg:col-span-2" : "max-w-3xl mx-auto"} w-full`}>
        {isController && (
          <div className="w-full max-w-3xl mb-6 flex items-center justify-between">
            <span className="text-sm opacity-70">{event.projects.length} submissions</span>
            <div className="flex gap-2">
              <button
                onClick={endVoting}
                disabled={transitioning}
                className={`px-3 py-1.5 rounded text-white text-sm transition duration-300 ${transitioning ? "bg-gray-400" : "bg-gray-600 hover:bg-gray-700"}`}
              >
                {transitioning ? "Ending..." : "End Voting"}
              </button>
            </div>
          </div>
        )}

        <div className="w-full max-w-3xl mx-auto flex items-center gap-4" style={{ minHeight: 300 }}>
          {currentCard && (
            <button
              onClick={handleSwipeLeft}
              className={`shrink-0 w-14 h-14 rounded-full text-2xl flex items-center justify-center transition duration-300 ${isDarkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-600 hover:bg-gray-300"}`}
              aria-label="Skip"
            >
              ✕
            </button>
          )}
          <div className="flex-1 min-w-0">
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
                    className="mt-4 px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition duration-300"
                  >
                    Add Another Project
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {currentCard && (
            <button
              onClick={handleSwipeRight}
              className={`shrink-0 w-14 h-14 rounded-full text-2xl flex items-center justify-center transition duration-300 ${isDarkMode ? "bg-purple-900/50 text-purple-300 hover:bg-purple-800/50" : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"}`}
              aria-label="Like"
            >
              ❤
            </button>
          )}
        </div>
      </div>
      {isController && (
        <div className="space-y-6">
          <VotingQueuePanel event={event} isDarkMode={isDarkMode} isController={isController} setEvent={setEvent} />
        </div>
      )}
    </div>
  );
}

function VotingQueuePanel({
  event,
  isDarkMode,
  isController,
  setEvent,
}: {
  event: EventDetail;
  isDarkMode: boolean;
  isController: boolean;
  setEvent: (e: EventDetail | null) => void;
}) {
  const allOrdered = useMemo(
    () => [...event.projects].sort((a, b) => a.position - b.position),
    [event]
  );

  const { topGroupIds } = useMemo(() => {
    const likeCounts = allOrdered.map(ep => ep.project.likes.length).sort((a, b) => b - a);
    const threshold = likeCounts.length >= 5 ? likeCounts[4] : -1;
    const ids = new Set(
      allOrdered
        .filter(ep => threshold >= 0 && ep.project.likes.length >= threshold)
        .map(ep => ep.id)
    );
    return { topGroupIds: ids };
  }, [allOrdered]);

  const firstNonTopIndex = allOrdered.findIndex(ep => !topGroupIds.has(ep.id));
  const hasTopGroup = topGroupIds.size > 0;

  const delistItem = async (eventProjectId: string) => {
    const res = await fetch(`/api/events/${event.id}/queue/${eventProjectId}`, { method: "DELETE" });
    if (res.status === 204) {
      const updated = await fetch(`/api/events/${event.id}`);
      setEvent(await updated.json());
    }
  };

  return (
    <div className={`w-full ${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl p-4 shadow`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Presentation queue</h3>
        <span className="text-xs opacity-60">{allOrdered.length} project{allOrdered.length !== 1 ? "s" : ""}</span>
      </div>
      {allOrdered.length === 0 ? (
        <div className="text-sm opacity-70">No projects in the queue yet.</div>
      ) : (
        <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
          {allOrdered.map((ep, idx) => {
            const isCurrent = ep.status === "CURRENT";
            const isPast = ep.status === "DONE" || ep.status === "SKIPPED";
            const isTopGroup = topGroupIds.has(ep.id);

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
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                    isCurrent
                      ? isDarkMode
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-indigo-300 bg-indigo-50"
                      : isTopGroup
                      ? isDarkMode
                        ? "border-yellow-600/40 bg-yellow-900/10"
                        : "border-yellow-300 bg-yellow-50"
                      : isDarkMode
                      ? "border-gray-700 bg-gray-800/70"
                      : "border-gray-200 bg-white"
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
                      className={`truncate mr-3 text-sm font-medium block ${
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
                  <div className="flex items-center gap-2 shrink-0">
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
                      <button
                        onClick={() => delistItem(ep.id)}
                        className="w-7 h-7 rounded-md text-xs bg-gray-500 text-white hover:bg-gray-600"
                        aria-label="Delist"
                        title="Remove from queue"
                      >
                        ✕
                      </button>
                    )}
                    <span
                      className={`px-2 h-7 rounded-md text-xs font-semibold flex items-center gap-1 ${
                        isDarkMode ? "bg-gray-700 text-gray-200" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      <span>❤</span>
                      <span>{ep.project.likes.length}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Timer helpers ────────────────────────────────────────
function formatTime(seconds: number): string {
  const mins = Math.floor(Math.abs(seconds) / 60);
  const secs = Math.floor(Math.abs(seconds) % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function TimerDisplay({
  startedAt,
  allottedSec,
  isDarkMode,
  label,
}: {
  startedAt: string;
  allottedSec: number;
  isDarkMode: boolean;
  label: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed((Date.now() - start) / 1000);
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startedAt]);

  const overtime = Math.max(0, elapsed - allottedSec);
  const isOver = overtime > 0;
  const remaining = Math.max(0, allottedSec - elapsed);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs uppercase tracking-wider opacity-70">{label}</span>
      <div className={`text-4xl font-mono font-bold tabular-nums ${isOver ? "text-red-500" : isDarkMode ? "text-white" : "text-gray-900"}`}>
        {isOver ? formatTime(elapsed) : formatTime(remaining)}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="opacity-60">Allotted: {formatTime(allottedSec)}</span>
        {isOver && (
          <span className="text-red-500 font-semibold">+{formatTime(overtime)} over</span>
        )}
      </div>
    </div>
  );
}

function CompletedTimerSummary({
  ep,
  isDarkMode,
}: {
  ep: EventProjectEntry;
  isDarkMode: boolean;
}) {
  if (!ep.presentingStartedAt) return null;

  const presStart = new Date(ep.presentingStartedAt).getTime();
  const qStart = ep.questionsStartedAt ? new Date(ep.questionsStartedAt).getTime() : null;
  const end = ep.completedAt ? new Date(ep.completedAt).getTime() : null;

  const presDuration = qStart ? (qStart - presStart) / 1000 : null;
  const qDuration = qStart && end ? (end - qStart) / 1000 : null;

  const presAllotted = ep.allottedPresentingSec ?? 0;
  const qAllotted = ep.allottedQuestionsSec ?? 0;

  return (
    <div className={`flex gap-4 text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
      {presDuration != null && (
        <span className={presDuration > presAllotted ? "text-red-400" : ""}>
          Pitch: {formatTime(presDuration)}/{formatTime(presAllotted)}
        </span>
      )}
      {qDuration != null && (
        <span className={qDuration > qAllotted ? "text-red-400" : ""}>
          Q&A: {formatTime(qDuration)}/{formatTime(qAllotted)}
        </span>
      )}
    </div>
  );
}

function PitchTimer({
  currentItem,
  eventId,
  isController,
  isDarkMode,
  onUpdate,
}: {
  currentItem: EventProjectEntry;
  eventId: string;
  isController: boolean;
  isDarkMode: boolean;
  onUpdate: () => void;
}) {
  const [acting, setActing] = useState(false);

  const timerAction = async (action: string) => {
    setActing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/pitch-timer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, eventProjectId: currentItem.id }),
      });
      if (res.ok) {
        if (action === "finish") {
          await fetch(`/api/events/${eventId}/advance`, { method: "POST" });
        }
        onUpdate();
      }
    } finally {
      setActing(false);
    }
  };

  const phase = currentItem.pitchPhase;

  return (
    <div className={`rounded-xl p-5 shadow ${isDarkMode ? "bg-gray-800" : "bg-white"}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Timer</h3>
        <span className={`text-xs uppercase tracking-wider px-2 py-1 rounded-full font-semibold ${
          phase === "WAITING" ? "bg-gray-200 text-gray-600" :
          phase === "PRESENTING" ? "bg-indigo-100 text-indigo-700" :
          phase === "QUESTIONS" ? "bg-purple-100 text-purple-700" :
          "bg-gray-200 text-gray-600"
        }`}>
          {phase === "WAITING" ? "Ready" : phase === "PRESENTING" ? "Presenting" : phase === "QUESTIONS" ? "Q&A" : "Done"}
        </span>
      </div>

      <div className="flex flex-col items-center gap-4">
        {phase === "WAITING" && (
          <>
            <div className="text-center opacity-70 text-sm">
              Allotted: {formatTime(currentItem.allottedPresentingSec ?? 0)} presenting, {formatTime(currentItem.allottedQuestionsSec ?? 0)} Q&A
            </div>
            {isController && (
              <button
                disabled={acting}
                onClick={() => timerAction("start_presenting")}
                className={`px-6 py-3 rounded-full text-white font-semibold transition duration-300 ${acting ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {acting ? "Starting..." : "Presentation Started"}
              </button>
            )}
          </>
        )}

        {phase === "PRESENTING" && currentItem.presentingStartedAt && (
          <>
            <TimerDisplay
              startedAt={currentItem.presentingStartedAt}
              allottedSec={currentItem.allottedPresentingSec ?? 120}
              isDarkMode={isDarkMode}
              label="Presenting"
            />
            {isController && (
              <button
                disabled={acting}
                onClick={() => timerAction("start_questions")}
                className={`px-6 py-3 rounded-full text-white font-semibold transition duration-300 ${acting ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {acting ? "Starting..." : "Q&A Started"}
              </button>
            )}
          </>
        )}

        {phase === "QUESTIONS" && currentItem.questionsStartedAt && (
          <>
            <TimerDisplay
              startedAt={currentItem.questionsStartedAt}
              allottedSec={currentItem.allottedQuestionsSec ?? 180}
              isDarkMode={isDarkMode}
              label="Q&A"
            />
            {isController && (
              <button
                disabled={acting}
                onClick={() => timerAction("finish")}
                className={`px-6 py-3 rounded-full text-white font-semibold transition duration-300 ${acting ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
              >
                {acting ? "Finishing..." : "Finished"}
              </button>
            )}
          </>
        )}

        {phase === "COMPLETED" && (
          <CompletedTimerSummary ep={currentItem} isDarkMode={isDarkMode} />
        )}
      </div>
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
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null);
  const isFinished = event.phase === "FINISHED";
  const hasUpcomingItems = useMemo(
    () => allOrdered.some(p => p.status === "QUEUED" || p.status === "APPROVED"),
    [allOrdered]
  );

  // Compute top-group
  const { topGroupIds } = useMemo(() => {
    const likeCounts = allOrdered.map(ep => ep.project.likes.length).sort((a, b) => b - a);
    const threshold = likeCounts.length >= 5 ? likeCounts[4] : -1;
    const ids = new Set(
      allOrdered
        .filter(ep => threshold >= 0 && ep.project.likes.length >= threshold)
        .map(ep => ep.id)
    );
    return { topGroupIds: ids };
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

  const finishEvent = async () => {
    const res = await fetch(`/api/events/${event.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPhase: "FINISHED" }),
    });
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

  const setCurrentProject = async (eventProjectId: string) => {
    setSettingCurrentId(eventProjectId);
    try {
      const res = await fetch(`/api/events/${event.id}/current`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventProjectId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.message) alert(body.message);
        return;
      }

      const updated = await fetch(`/api/events/${event.id}`);
      setEvent(await updated.json());
    } finally {
      setSettingCurrentId(null);
    }
  };

  // Find first non-top item index for the divider
  const firstNonTopIndex = allOrdered.findIndex(ep => !topGroupIds.has(ep.id));
  const hasTopGroup = topGroupIds.size > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl p-4 shadow lg:col-span-2`}>
        <h2 className="font-semibold mb-3">Current project</h2>
        {currentItem ? (
          <div className="max-w-5xl space-y-4">
            <PitchTimer
              currentItem={currentItem}
              eventId={event.id}
              isController={isController}
              isDarkMode={isDarkMode}
              onUpdate={async () => {
                const res = await fetch(`/api/events/${event.id}`);
                if (res.ok) setEvent(await res.json());
              }}
            />
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
          <div className="opacity-70">
            {isFinished ? "This event is finished. The queue is closed." : "No current project"}
          </div>
        )}
      </div>
      <div className="space-y-6">
        <div className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl p-4 shadow`}>
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
                      <div className="min-w-0">
                        <a
                          href={`/projects/${ep.project.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`truncate mr-3 text-sm font-medium block ${
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
                      {isController && !isFinished && !isCurrent && (
                        <button
                          onClick={() => setCurrentProject(ep.id)}
                          disabled={settingCurrentId !== null}
                          className={`px-2 h-7 rounded-md text-[11px] font-semibold transition ${
                            settingCurrentId !== null
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                              : isDarkMode
                              ? "bg-indigo-900/60 text-indigo-100 hover:bg-indigo-800/70"
                              : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                          }`}
                          title="Set as current project"
                        >
                          {settingCurrentId === ep.id ? "Setting..." : "Set current"}
                        </button>
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
                            className="w-7 h-7 rounded-md text-xs bg-gray-500 text-white hover:bg-gray-600"
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
                            className="w-7 h-7 rounded-md text-xs bg-gray-500 text-white hover:bg-gray-600"
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
                            ? "bg-red-600 text-white"
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
            {!isFinished && (
              <button onClick={openJoin} className="w-full px-1.5 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition duration-300">
                Add Project
              </button>
            )}
            {isController && !isFinished && (currentItem || hasUpcomingItems) && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={previousStep} className="w-full px-1.5 py-1 rounded bg-gray-600 text-white text-sm hover:bg-gray-700 transition duration-300">
                  Previous
                </button>
                <button onClick={advance} className="w-full px-1.5 py-1 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition duration-300">
                  Move next
                </button>
              </div>
            )}
            {isController && !isFinished && !currentItem && !hasUpcomingItems && (
              <button onClick={finishEvent} className="w-full px-1.5 py-1 rounded bg-gray-600 text-white text-sm hover:bg-gray-700 transition duration-300">
                Finish Event
              </button>
            )}
            {isFinished && (
              <div className={`sm:col-span-2 rounded-md px-3 py-2 text-sm ${isDarkMode ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"}`}>
                Event finished. New projects cannot be added to this queue.
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

  // Edit event modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editMeetingUrl, setEditMeetingUrl] = useState("");
  const [editMcIds, setEditMcIds] = useState<string[]>([]);
  const [allHackers, setAllHackers] = useState<Array<{ id: string; name: string }>>([]);
  const [mcSearch, setMcSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [phaseTransitioning, setPhaseTransitioning] = useState<EventPhase | null>(null);

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

  const transitionEvent = async (targetPhase: EventPhase) => {
    if (!event) return;
    setPhaseTransitioning(targetPhase);
    try {
      const res = await fetch(`/api/events/${event.id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhase }),
      });
      if (res.ok) {
        const updated = await fetch(`/api/events/${event.id}`);
        setEvent(await updated.json());
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (body?.message) alert(body.message);
    } finally {
      setPhaseTransitioning(null);
    }
  };

  const openJoin = async () => {
    if (event?.phase === "FINISHED") {
      alert("This event is finished. You can no longer add projects to the queue.");
      return;
    }
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

  const openEdit = async () => {
    if (!event) return;
    setEditTitle(event.title);
    setEditStartTime(new Date(event.startTime).toISOString().slice(0, 16));
    setEditMeetingUrl(event.meetingUrl || "");
    setEditMcIds(event.mcs.map(m => m.hacker.id));
    setMcSearch("");
    try {
      const res = await fetch("/api/hackers");
      setAllHackers(await res.json());
    } catch {}
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!event) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, startTime: new Date(editStartTime).toISOString(), meetingUrl: editMeetingUrl, mcIds: editMcIds }),
      });
      if (res.ok) {
        setEvent(await res.json());
        setShowEdit(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredHackers = useMemo(() => {
    const q = mcSearch.trim().toLowerCase();
    if (!q) return [];
    return allHackers
      .filter(h => !editMcIds.includes(h.id) && h.name.toLowerCase().includes(q))
      .slice(0, 10);
  }, [mcSearch, allHackers, editMcIds]);

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
      if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        if (body?.message) {
          alert(body.message);
        }
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

  if (loading) return <div className={`min-h-screen font-space-mono flex items-center justify-center ${isDarkMode ? "bg-gradient-to-b from-gray-900 to-black text-gray-100" : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-900"}`}>Loading...</div>;
  if (!event) return <div className={`min-h-screen font-space-mono flex items-center justify-center ${isDarkMode ? "bg-gradient-to-b from-gray-900 to-black text-gray-100" : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-900"}`}>Event not found</div>;

  return (
    <>
      <div className={`min-h-screen font-space-mono ${isDarkMode ? "bg-gradient-to-b from-gray-900 to-black text-gray-100" : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-900"}`}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-16">
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
              {isController && (
                <button
                  onClick={openEdit}
                  className={`px-3 py-2 rounded-md text-sm ${isDarkMode ? "bg-gray-700 text-gray-200 hover:bg-gray-600" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}
                >
                  Edit Event
                </button>
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

      {showEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl w-full max-w-lg p-6 shadow-xl`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Edit Event</h2>
              <button onClick={() => setShowEdit(false)} className="text-sm opacity-70">
                Close
              </button>
            </div>

            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Event title"
              className={`w-full px-3 py-2 rounded-md mb-4 ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-gray-100 text-gray-900"}`}
            />

            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="datetime-local"
              value={editStartTime}
              onChange={e => setEditStartTime(e.target.value)}
              className={`w-full px-3 py-2 rounded-md mb-4 ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-gray-100 text-gray-900"}`}
            />

            <label className="block text-sm font-medium mb-1">Meeting URL</label>
            <input
              value={editMeetingUrl}
              onChange={e => setEditMeetingUrl(e.target.value)}
              placeholder="https://zoom.us/j/..."
              className={`w-full px-3 py-2 rounded-md mb-4 ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-gray-100 text-gray-900"}`}
            />

            <label className="block text-sm font-medium mb-1">MCs</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {editMcIds.map(id => {
                const h = allHackers.find(h => h.id === id);
                return (
                  <span
                    key={id}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${isDarkMode ? "bg-indigo-800 text-indigo-100" : "bg-indigo-100 text-indigo-800"}`}
                  >
                    {h?.name || id}
                    <button
                      onClick={() => setEditMcIds(prev => prev.filter(x => x !== id))}
                      className="ml-1 hover:opacity-70"
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
            </div>
            <input
              value={mcSearch}
              onChange={e => setMcSearch(e.target.value)}
              placeholder="Search hackers to add as MC..."
              className={`w-full px-3 py-2 rounded-md ${isDarkMode ? "bg-gray-800 text-gray-100" : "bg-gray-100 text-gray-900"}`}
            />
            {filteredHackers.length > 0 && (
              <div className={`mt-1 rounded-md border max-h-40 overflow-y-auto ${isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
                {filteredHackers.map(h => (
                  <button
                    key={h.id}
                    onClick={() => {
                      setEditMcIds(prev => [...prev, h.id]);
                      setMcSearch("");
                    }}
                    className={`w-full text-left px-3 py-2 text-sm ${isDarkMode ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">Phase</label>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm opacity-70">Current:</span>
                <StageBadge phase={event.phase} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["VOTING", "PITCHING", "FINISHED"] as EventPhase[])
                  .filter(phase => phase !== event.phase)
                  .map(phase => (
                    <button
                      key={phase}
                      onClick={() => transitionEvent(phase)}
                      disabled={phaseTransitioning !== null}
                      className={`px-3 py-2 rounded-md text-sm text-white transition duration-300 ${
                        phaseTransitioning !== null
                          ? "bg-gray-400"
                          : phase === "VOTING"
                          ? "bg-indigo-600 hover:bg-indigo-700"
                          : phase === "PITCHING"
                          ? "bg-indigo-600 hover:bg-indigo-700"
                          : "bg-gray-600 hover:bg-gray-700"
                      }`}
                    >
                      {phaseTransitioning === phase ? "Updating..." : getPhaseActionLabel(phase, event.phase)}
                    </button>
                  ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowEdit(false)}
                className={`${isDarkMode ? "bg-gray-800 text-gray-200" : "bg-gray-100 text-gray-800"} px-4 py-2 rounded-md`}
              >
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={saveEdit}
                className={`px-4 py-2 rounded-md ${saving ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"} text-white`}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl w-full max-w-lg p-6 shadow-xl`}>
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
                className={`px-4 py-2 rounded-full ${confirming ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"} text-white transition duration-300`}
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
