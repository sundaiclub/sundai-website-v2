"use client";
import React, { useCallback, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTheme } from "../contexts/ThemeContext";
import { useUserContext } from "../contexts/UserContext";
import { markdownToHtml } from "@/lib/markdownToHtml";

type WeeklyTopProject = {
  id: string;
  title: string;
  preview: string | null;
  createdAt: string;
  likeCount: number;
  thumbnailUrl: string | null;
  launchLead: { id: string; name: string; linkedinUrl: string | null; twitterUrl: string | null };
  team: { id: string; name: string; linkedinUrl: string | null; twitterUrl: string | null }[];
  projectUrl: string;
};

export default function NewsClient() {
  const { isDarkMode } = useTheme();
  const { isAdmin } = useUserContext();
  const [loading, setLoading] = useState(false);
  const [topProjects, setTopProjects] = useState<WeeklyTopProject[]>([]);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState<string>("");

  // Compute Sundai Week number since January 14, 2024
  const weekNumber = useMemo(() => {
    const origin = new Date(Date.UTC(2024, 0, 14, 0, 0, 0));
    const now = new Date();
    const diffMs = now.getTime() - origin.getTime();
    const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    return weeks > 0 ? weeks : 1;
  }, []);

  const loadTopProjects = useCallback(async () => {
    const resp = await fetch("/api/news/weekly");
    const data = await resp.json();
    return (data.topProjects || []) as WeeklyTopProject[];
  }, []);

  const linkedinPost = useMemo(() => {
    if (topProjects.length === 0) return "";
    const lines: string[] = [];
    lines.push("🚀 Sundai Weekly: Top Projects of the Week\n");
    topProjects.forEach((p, idx) => {
      const builders = [p.launchLead.name, ...p.team.map(t => t.name)].join(", ");
      lines.push(`${idx + 1}. ${p.title} — ${p.preview || ""}`);
      lines.push(`Built by: ${builders}`);
      lines.push(`Like it on Sundai: ${p.projectUrl}`);
      lines.push("");
    });
    lines.push("See more projects: https://www.sundai.club/projects");
    lines.push("#Sundai #BuildInPublic #Innovation");
    return lines.join("\n");
  }, [topProjects]);

  const buildEmailHtml = useCallback((projects: WeeklyTopProject[], aiNewsHtml?: string) => {
    const projectsItems = projects.map((p, idx) => {
      const likeUrl = `${p.projectUrl}?like=1`;
      const people = [
        { id: p.launchLead.id, name: p.launchLead.name },
        ...p.team.map(t => ({ id: t.id, name: t.name }))
      ];
      const teamLinks = people
        .map(m => `<a href="https://www.sundai.club/hacker/${m.id}" style="color:#111827;text-decoration:underline">${m.name}</a>`) 
        .join(', ');
      const rank = idx === 0 ? '1st' : idx === 1 ? '2nd' : idx === 2 ? '3rd' : idx === 3 ? '4th' : '5th';
      const rankColor = idx === 0 ? '#f59e0b' : idx === 1 ? '#6b7280' : idx === 2 ? '#d97706' : '#9ca3af';
      return `
        <div style="padding:14px 0">
          <div style="display:flex;align-items:center;margin-bottom:6px">
            <span style="display:inline-block;padding:2px 8px;background:${rankColor};color:#ffffff;border-radius:9999px;font-size:12px;margin-right:8px">${rank}</span>
            <h3 style="margin:0;font-size:16px;line-height:24px;color:#111827">${p.title}</h3>
          </div>
          <p style="margin:0 0 6px;color:#374151">${p.preview || ""}</p>
          <p style="margin:0 0 10px;color:#6b7280">Built by: ${teamLinks}</p>
          ${p.thumbnailUrl ? `<img src="${p.thumbnailUrl}" alt="${p.title}" style="width:260px;height:auto;border-radius:10px;border:1px solid #e5e7eb;margin:8px 0" />` : ''}
          <div style="margin-top:8px">
            <a href="${p.projectUrl}" style="display:inline-block;padding:10px 14px;background:#111827;color:#ffffff;text-decoration:none;border-radius:8px">View project</a>
            <a href="${likeUrl}" style="display:inline-block;padding:10px 14px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;margin-left:8px">❤ Like on Sundai</a>
          </div>
        </div>`;
    }).join("");

    const introOutline = `
      <section id="outline" style="padding:14px 16px;border-bottom:1px solid #e5e7eb">
        <p style="margin:0 0 10px;color:#374151">We reworked this weekly email and added many more cool things. This is what we'll be sending each week now:</p>
        <div style="margin:0;display:flex;flex-wrap:wrap;gap:8px">
          <a href="#next-hack" style="display:inline-block;padding:6px 10px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:9999px;color:#111827;text-decoration:none">🚀 Next Sundai Hack(s)</a>
          <a href="#community-news" style="display:inline-block;padding:6px 10px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:9999px;color:#111827;text-decoration:none">📣 Community News</a>
          <a href="#ai-news" style="display:inline-block;padding:6px 10px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:9999px;color:#111827;text-decoration:none">🧠 Weekly AI News</a>
          <a href="#best-projects" style="display:inline-block;padding:6px 10px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:9999px;color:#111827;text-decoration:none">🏆 Best Hacks from last Sundai</a>
        </div>
      </section>`;

    const nextHack = `
      <section id="next-hack" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <img src="https://www.sundai.club/icon.svg" alt="Sundai" width="28" height="28" style="display:inline-block;border-radius:6px;border:1px solid #e5e7eb" />
          <strong style="font-size:16px;color:#111827">Next Sundai Hack · Oct 5</strong>
        </div>
        <h2 style="margin:0 0 6px;font-size:18px;line-height:26px;color:#111827">Sundai Research Hack w/ MIT CSAIL's Yoon Kim</h2>
        <p style="margin:0;color:#374151">Sun, Oct 5 · 10:00am</p>
        <ul style="margin:10px 0 0 18px;color:#374151;padding:0">
          <li>Faster LLMs without collapse</li>
          <li>Cross-scale hallucination checks</li>
          <li>Smarter memory/compute trade-offs</li>
          <li>Adaptive quantization in training</li>
        </ul>
        <div style="margin-top:12px">
          <a href="https://partiful.com/e/C3mnrNSv8YGnZefXcL0D" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px">RSVP on Partiful</a>
        </div>
      </section>`;

    const hackerCombinator = `
      <section id="hc-event" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <img src="https://www.sundai.club/icon.svg" alt="Sundai" width="28" height="28" style="display:inline-block;border-radius:6px;border:1px solid #e5e7eb" />
          <strong style="font-size:16px;color:#111827">Apply to Hacker Combinator v2 by Oct 12th </strong>
        </div>
        <p style="margin:6px 0 0;color:#374151">Oct 26 - Nov 7</p>
        <p style="margin:10px 0 0;color:#374151">Are you a technical founder applying to YC this Fall? Join our YC Startup Track to grow traction for 3 weeks, then apply to Y Combinator with us.</p>
        <ul style="margin:10px 0 0 18px;color:#374151;padding:0">
          <li>Focus on growth and traction before the YC app</li>
          <li>Meet YC founders and mentors</li>
          <li>Build with top hackers from Harvard & MIT; real critique</li>
        </ul>
        <p style="margin:10px 0 0;color:#6b7280">Sessions: Oct 26, Nov 2, 9 (10am–7pm). YC deadline: Mon Nov 10.</p>
        <div style="margin-top:10px">
          <a href="https://partiful.com/e/3uGkKaX39S0PtOFW7DP9" style="display:inline-block;padding:10px 14px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px">RSVP on Partiful</a>
        </div>
      </section>`;

    const communityNews = `
      <section id="community-news" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <h2 style="margin:0 0 8px;font-size:18px;line-height:26px;color:#111827;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:20px;height:20px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;text-align:center;line-height:20px;font-size:12px">📣</span> Community News</h2>
        <p style="margin:0;color:#374151">Here we will be sharing the main updates in the Sundai community. Not much this week. Artem reworked this emails, and Serge sent it. From now on you'll get a tighter, more structured updates: next hack, community notes, last week’s AI news TL;DR, and the best projects. Hit reply with feedback — we build in public.</p>
      </section>`;

    const fallbackAiNews = `
        <ul style="margin:8px 0 0 18px;color:#374151;padding:0">
          <li>GLM Coding plan is 10% off if you use the Vector Lab signup code</li>
          <li>OpenAI releases Chat with Apps, Agentkit, and a bunch of other stuff at Dev Day</li>
          <li>Qwen3 VL gets a small variant</li>
          <li>Can you give an LLM a gambling addiction</li>
          <li>And more in this week's news!</li>
        </ul>
        <p style="margin:10px 0 0;color:#374151">Shoutout to Andrew for leading Sundai News.</p>
        <p style="margin:6px 0 0;color:#374151">Audio version available <a href="https://open.spotify.com/show/7LKYxvGAGSj1pso4aklh9O" style="color:#111827;text-decoration:underline">on Spotify</a>. Join the <a href="https://discord.gg/HrNXgwpVzd" style="color:#111827;text-decoration:underline">Discord</a>. Read the <a href="https://vectorlab.dev/weekly-10-6-to-10-12" style="color:#111827;text-decoration:underline">full article on the VectorLab website</a>.</p>`;

    const newsTLDR = `
      <section id="ai-news" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <h2 style="margin:0 0 8px;font-size:18px;line-height:26px;color:#111827;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:20px;height:20px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;text-align:center;line-height:20px;font-size:12px">🧠</span> Weekly AI News · TL;DR</h2>
        ${aiNewsHtml && aiNewsHtml.trim().length > 0 ? aiNewsHtml : fallbackAiNews}
      </section>`;

    const projectsBlock = `
      <section id="best-projects" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <h2 style="margin:0 0 6px;font-size:18px;line-height:26px;color:#111827;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:20px;height:20px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;text-align:center;line-height:20px;font-size:12px">🏆</span> Check out the best hacks of the last week</h2>
        <p style="margin:0 6px 6px 0;color:#374151">Voted by your likes — show some love, and help great hacks trend.</p>
        ${projectsItems || `<p style="margin:0;color:#6b7280">No projects this week.</p>`}
      </section>`;

    return `<!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta charSet="utf-8" />
        <title>Sundai Weekly</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin:0; background:#f9fafb; }
          .container { max-width: 740px; margin: 0 auto; background:#ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .header { padding: 20px 16px; border-bottom: 1px solid #e5e7eb; display:flex; align-items:center; gap:12px; }
          .footer { padding: 20px 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="header">
            <h1 style="margin:0;font-size:24px;line-height:32px;color:#111827">Sundai Week #${weekNumber}</h1>
          </header>
          ${introOutline}
          ${nextHack}
          ${hackerCombinator}
          ${communityNews}
          ${newsTLDR}
          ${projectsBlock}
          <footer class="footer">
            <p style="margin:0">Want to be featured? Come hack at <a href="https://www.sundai.club/events" style="color:#111827">sundai.club/events</a>.</p>
            <p style="margin:6px 0 0;color:#374151">Browse more projects ➜ <a href="https://www.sundai.club/projects" style="color:#111827;text-decoration:underline">sundai.club/projects</a></p>
          </footer>
        </div>
      </body>
    </html>`;
  }, [weekNumber]);

  const extractBodyInnerHtml = (fullHtml: string) => {
    const match = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : fullHtml;
  };

  const rebuildHtmlWithBody = (fullHtml: string, newBodyInner: string) => {
    if (!fullHtml.includes('<body')) {
      return fullHtml;
    }
    return fullHtml.replace(/<body[^>]*>[\s\S]*?<\/body>/i, `<body>\n${newBodyInner}\n</body>`);
  };

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const freshTop = await loadTopProjects();
      setTopProjects(freshTop);
      // Fetch TLDR markdown from VectorLab and convert to HTML
      let aiNewsHtml: string | undefined = undefined;
      try {
        const tldrResp = await fetch('https://vectorlab.dev/api/tldr', { cache: 'no-store' });
        if (tldrResp.ok) {
          const tldrText = await tldrResp.text();
          aiNewsHtml = markdownToHtml(tldrText || '');
        }
      } catch (e) {
        // Silent fallback to built-in TLDR
      }

      let built = buildEmailHtml(freshTop, aiNewsHtml);
      if (instruction.trim().length > 0) {
        const bodyInner = extractBodyInnerHtml(built);
        const resp = await fetch('/api/news/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'text/plain' },
          body: JSON.stringify({ htmlBody: bodyInner, instruction }),
        });
        if (!resp.ok) {
          toast.error('Generation failed. Please try again.');
        }
        // Try streaming first
        const contentType = (resp as any).headers && typeof (resp as any).headers.get === 'function'
          ? ((resp as any).headers.get('Content-Type') || '')
          : '';
        if ((resp as any).body && typeof (resp as any).body.getReader === 'function' && contentType.includes('text/plain')) {
          const reader = (resp as any).body.getReader();
          const decoder = new TextDecoder();
          let accum = '';
          // Set initial HTML while streaming starts
          setGeneratedHtml(rebuildHtmlWithBody(built, accum));
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            accum += decoder.decode(value, { stream: true });
            setGeneratedHtml(rebuildHtmlWithBody(built, accum));
          }
          // Ensure final decode flush
          accum += decoder.decode();
          built = rebuildHtmlWithBody(built, accum || bodyInner);
        } else {
          const data = await resp.json().catch(() => ({}));
          if (data && data.error) {
            toast.error(String(data.error));
          }
          const updatedInner = (data && data.htmlBody) || bodyInner;
          built = rebuildHtmlWithBody(built, updatedInner);
        }
      }
      setGeneratedHtml(built);
    } catch (e) {
      console.error('Failed to generate weekly email', e);
      toast.error('Failed to generate weekly email');
    } finally {
      setLoading(false);
    }
  }, [buildEmailHtml, instruction, loadTopProjects]);

  // Page is public; no admin gate

  return (
    <div className={`${isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"} font-space-mono min-h-screen`}>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-6">Weekly News</h1>
        <div className="grid grid-cols-1 gap-6">
          <section>
            <label htmlFor="instruction" className="block text-sm font-medium mb-2">Optional instruction to modify the email</label>
            <textarea
              id="instruction"
              placeholder="e.g., Add a section announcing next week's speaker, adjust wording to be more concise"
              className={`w-full h-24 p-3 border rounded text-sm ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                className="px-3 py-2 rounded bg-indigo-600 text-white disabled:opacity-50"
                onClick={handleGenerate}
                disabled={loading}
              >{loading ? 'Generating…' : 'Generate'}</button>
              {generatedHtml && (
                <button
                  className="px-3 py-2 rounded bg-gray-900 text-white"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(generatedHtml);
                      setCopiedEmail(true);
                      setTimeout(() => setCopiedEmail(false), 1500);
                    } catch (e) {
                      console.error('Clipboard write failed', e);
                    }
                  }}
                  aria-live="polite"
                >{copiedEmail ? 'Copied!' : 'Copy Email HTML'}</button>
              )}
            </div>
          </section>

          {loading && (
            <div role="status" aria-live="polite">Loading weekly highlights…</div>
          )}

          {generatedHtml && (
            <section>
              <h2 className="text-xl font-semibold mb-2">Email HTML</h2>
              <textarea
                readOnly
                className={`w-full h-96 p-3 border rounded font-mono text-xs ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                value={generatedHtml}
              />
            </section>
          )}

          {generatedHtml && (
            <section>
              <h2 className="text-xl font-semibold mb-2">Preview</h2>
              <div className={`w-full border rounded ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <iframe
                  title="Email Preview"
                  className="w-full h-[540px] bg-white"
                  srcDoc={generatedHtml}
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}


