"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { useUserContext } from "../contexts/UserContext";
import { useTheme } from "../contexts/ThemeContext";
import { HackerSelector, type Hacker } from "../components/HackerSelector";

type EventListItem = {
  id: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
  meetingUrl?: string | null;
  phase: "VOTING" | "PITCHING" | "FINISHED";
};

function getPhaseBadgeStyles(phase: EventListItem["phase"]) {
  if (phase === "VOTING") return "bg-indigo-100 text-indigo-700";
  if (phase === "PITCHING") return "bg-purple-100 text-purple-700";
  return "bg-gray-200 text-gray-700";
}

function getPhaseBadgeLabel(phase: EventListItem["phase"]) {
  if (phase === "VOTING") return "Voting Open";
  if (phase === "PITCHING") return "Pitching";
  return "Finished";
}

function Countdown({ start }: { start: string }) {
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, new Date(start).getTime() - now);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return <span>{hours}h {minutes}m {seconds}s</span>;
}

export default function PitchPage() {
  const { isDarkMode } = useTheme();
  const { isSignedIn, isLoaded } = useUser();
  const { isAdmin } = useUserContext();
  const router = useRouter();
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    // Create today at 8pm EST (UTC-5) = 01:00 UTC next day, but we want local-aware
    // datetime-local uses local time, so compute 8pm EST as a Date and format it
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    est.setHours(20, 0, 0, 0);
    const yyyy = est.getFullYear();
    const mm = String(est.getMonth() + 1).padStart(2, "0");
    const dd = String(est.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T20:00`;
  });
  const [endTime, setEndTime] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [hackers, setHackers] = useState<Hacker[]>([]);
  const [selectedMCs, setSelectedMCs] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);
  const [votingEndTime, setVotingEndTime] = useState("");
  const [topProjectCount, setTopProjectCount] = useState(5);
  const [topPresentingSec, setTopPresentingSec] = useState(120);
  const [topQuestionsSec, setTopQuestionsSec] = useState(180);
  const [defaultPresentingSec, setDefaultPresentingSec] = useState(60);
  const [defaultQuestionsSec, setDefaultQuestionsSec] = useState(120);

  useEffect(() => {
    let interval: any;
    const load = async () => {
      try {
        const res = await fetch("/api/events");
        const data = await res.json();
        const mapped: EventListItem[] = data.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          startTime: e.startTime,
          endTime: e.endTime,
          meetingUrl: e.meetingUrl,
          phase: e.phase,
        }));
        setEvents(mapped);
      } finally {
        setLoading(false);
      }
    };
    load();
    const onFocus = () => load();
    const onVisibility = () => { if (!document.hidden) load(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    interval = setInterval(load, 10000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (showSelector) {
      (async () => {
        try {
          const res = await fetch('/api/hackers');
          const hs = await res.json();
          setHackers(hs);
        } catch {}
      })();
    }
  }, [showSelector]);

  const filteredHackers = hackers.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.email?.toLowerCase().includes(searchTerm.toLowerCase()));

  async function createEvent() {
    if (!title || !startTime) {
      alert("Title and start time are required");
      return;
    }
    try {
      const body: any = {
        title,
        meetingUrl: meetingUrl || null,
        startTime,
        endTime: endTime || null,
        mcIds: selectedMCs,
        votingEndTime: votingEndTime || null,
        topProjectCount,
        topPresentingSec,
        topQuestionsSec,
        defaultPresentingSec,
        defaultQuestionsSec,
      };
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        alert('Only admins can create events');
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.message || 'Failed to create event');
        return;
      }
      const created = await res.json();
      setShowCreate(false);
      setTitle(""); setMeetingUrl(""); setStartTime(""); setEndTime(""); setSelectedMCs([]); setVotingEndTime(""); setTopProjectCount(5); setTopPresentingSec(120); setTopQuestionsSec(180); setDefaultPresentingSec(60); setDefaultQuestionsSec(120);
      router.push(`/pitch/${created.id}`);
    } catch (e) {
      console.error(e);
    }
  }

  if (!isLoaded) {
    return (
      <div className={`min-h-screen font-space-mono flex items-center justify-center ${isDarkMode ? "bg-gradient-to-b from-gray-900 to-black text-gray-100" : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-900"}`}>
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={`min-h-screen font-space-mono flex items-center justify-center ${isDarkMode ? "bg-gradient-to-b from-gray-900 to-black text-gray-100" : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-900"}`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">You need to be logged in to view this page</h1>
          <SignInButton mode="modal">
            <button className="px-6 py-3 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition duration-300 text-lg">
              Log In / Sign Up
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-space-mono ${isDarkMode ? "bg-gradient-to-b from-gray-900 to-black text-gray-100" : "bg-gradient-to-b from-[#E5E5E5] to-[#F0F0F0] text-gray-900"}`}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Pitch at Sundai</h1>
          {isAdmin && (
            <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition duration-300">
              Create Event
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-24 text-center">Loading...</div>
        ) : events.length === 0 ? (
          <div className="py-24 text-center">No upcoming events</div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const nowTs = Date.now();
              const TWO_HOURS = 2 * 60 * 60 * 1000;
              const sorted = [...events].sort((a,b)=> new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
              const ongoing = sorted.filter(e => {
                const s = new Date(e.startTime).getTime();
                return e.phase !== "FINISHED" && s <= nowTs && nowTs < s + TWO_HOURS;
              });
              const current = ongoing.at(-1) || null;
              const upcoming = sorted.filter(e => e.phase !== "FINISHED" && new Date(e.startTime).getTime() > nowTs);
              const past = sorted.filter(e => e.phase === "FINISHED" || new Date(e.startTime).getTime() + TWO_HOURS <= nowTs);

              return (
                <>
                  {current ? (
                    <div className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl p-6 shadow`}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold">Live now: {current.title}</h2>
                          <p className="text-sm opacity-80">Started {new Date(current.startTime).toLocaleString()}</p>
                        </div>
                        <Link href={`/pitch/${current.id}`} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition duration-300">Open Event</Link>
                      </div>
                    </div>
                  ) : (
                    upcoming[0] && (
                      <div className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-xl p-6 shadow`}>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div>
                            <h2 className="text-xl font-semibold">Next up: {upcoming[0].title}</h2>
                            <p className="text-sm opacity-80">Starts in <Countdown start={upcoming[0].startTime} /></p>
                          </div>
                          <Link href={`/pitch/${upcoming[0].id}`} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition duration-300">Open Event</Link>
                        </div>
                      </div>
                    )
                  )}

                  {upcoming.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Upcoming</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {upcoming.map((e) => (
                          <li key={e.id} className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-lg p-4 shadow`}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{e.title}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getPhaseBadgeStyles(e.phase)}`}>{getPhaseBadgeLabel(e.phase)}</span>
                                </div>
                                <div className="text-sm opacity-75"><Countdown start={e.startTime} /></div>
                              </div>
                              <Link href={`/pitch/${e.id}`} className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm transition duration-300">View</Link>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {past.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Past events</h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...past].reverse().map((e) => (
                          <li key={e.id} className={`${isDarkMode ? "bg-gray-800" : "bg-white"} rounded-lg p-4 shadow`}>
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{e.title}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getPhaseBadgeStyles(e.phase)}`}>{getPhaseBadgeLabel(e.phase)}</span>
                                </div>
                                <div className="text-sm opacity-75">Started {new Date(e.startTime).toLocaleString()}</div>
                              </div>
                              <Link href={`/pitch/${e.id}`} className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm transition duration-300">View</Link>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              );
            })()}

          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Event</h2>
              <button onClick={() => setShowCreate(false)} className="text-sm opacity-70">Close</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Title</label>
                <input value={title} onChange={e=>setTitle(e.target.value)} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} placeholder="Sundai Pitches" />
              </div>
              <div>
                <label className="block text-sm mb-1">Meeting link</label>
                <input value={meetingUrl} onChange={e=>setMeetingUrl(e.target.value)} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} placeholder="https://zoom.us/j/…" />
              </div>
              <div>
                <label className="block text-sm mb-1">Start time</label>
                <input type="datetime-local" value={startTime} onChange={e=>setStartTime(e.target.value)} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
              </div>
              <div>
                <label className="block text-sm mb-1">Voting End Time</label>
                <input type="datetime-local" value={votingEndTime} onChange={e=>setVotingEndTime(e.target.value)} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} placeholder="Default: 15 min after start" />
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Leave empty for 15 min after start</p>
              </div>
              <div>
                <label className="block text-sm mb-2">MCs</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {hackers.filter(h=>selectedMCs.includes(h.id)).map(h=> (
                    <span key={h.id} className={`${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} px-2 py-1 rounded-full text-sm`}>{h.name}</span>
                  ))}
                </div>
                <button onClick={()=>setShowSelector(true)} className="px-3 py-2 rounded-md bg-gray-200 text-gray-900 text-sm">
                  Add MCs
                </button>
              </div>
              <div className={`rounded-lg p-4 ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <h3 className="text-sm font-semibold mb-3">Presentation Timing</h3>
                <div>
                  <label className="block text-xs font-medium mb-1">Number of Top Projects</label>
                  <input type="number" min={0} value={topProjectCount} onChange={e=>setTopProjectCount(Math.max(0, parseInt(e.target.value) || 0))} className={`w-full px-3 py-2 rounded-md mb-3 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Top Presenting (sec)</label>
                    <input type="number" min={0} step={10} value={topPresentingSec} onChange={e=>setTopPresentingSec(Math.max(0, parseInt(e.target.value) || 0))} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Top Q&A (sec)</label>
                    <input type="number" min={0} step={10} value={topQuestionsSec} onChange={e=>setTopQuestionsSec(Math.max(0, parseInt(e.target.value) || 0))} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Regular Presenting (sec)</label>
                    <input type="number" min={0} step={10} value={defaultPresentingSec} onChange={e=>setDefaultPresentingSec(Math.max(0, parseInt(e.target.value) || 0))} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Regular Q&A (sec)</label>
                    <input type="number" min={0} step={10} value={defaultQuestionsSec} onChange={e=>setDefaultQuestionsSec(Math.max(0, parseInt(e.target.value) || 0))} className={`w-full px-3 py-2 rounded-md ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={()=>setShowCreate(false)} className={`${isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'} px-4 py-2 rounded-md`}>Cancel</button>
              <button disabled={!title || !startTime} onClick={createEvent} className={`px-4 py-2 rounded-md ${!title || !startTime ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}>Create</button>
            </div>
          </div>
        </div>
      )}

      <HackerSelector
        showModal={showSelector}
        setShowModal={setShowSelector}
        isDarkMode={isDarkMode}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filteredHackers={filteredHackers}
        title="Select MCs"
        singleSelect={false}
        selectedIds={selectedMCs}
        showRoleSelector={false}
        handleAddMember={(h)=> setSelectedMCs(prev => prev.includes(h.id) ? prev.filter(id=>id!==h.id) : [...prev, h.id])}
      />
    </div>
  );
}
