"use client";
import React, { useCallback, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useTheme } from "../contexts/ThemeContext";
import { useUserContext } from "../contexts/UserContext";
 

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
    const weeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
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
      return `
        <div style="padding:16px 0;border-top:1px solid #e5e7eb">
          <div style="display:flex;align-items:center;margin-bottom:6px">
            <span style="display:inline-block;padding:2px 8px;border:1px solid #111827;color:#111827;border-radius:0;font-size:12px;margin-right:8px">${rank}</span>
            <h3 style="margin:0;font-size:16px;line-height:24px;color:#111827">${p.title}</h3>
          </div>
          <p style="margin:0 0 6px;color:#374151">${p.preview || ""}</p>
          <p style="margin:0 0 10px;color:#6b7280">Built by: ${teamLinks}</p>
          ${p.thumbnailUrl ? `<img src="${p.thumbnailUrl}" alt="${p.title}" style="width:260px;height:auto;border-radius:0;border:1px solid #e5e7eb;margin:8px 0" />` : ''}
          <div style="margin-top:8px">
            <a href="${p.projectUrl}" style="display:inline-block;padding:10px 14px;background:#111827;color:#ffffff;text-decoration:none;border-radius:0;border:1px solid #111827">View project</a>
            <a href="${likeUrl}" style="display:inline-block;padding:10px 14px;background:transparent;color:#111827;text-decoration:none;border-radius:0;border:1px solid #111827;margin-left:8px">Like on Sundai</a>
          </div>
        </div>`;
    }).join("");

    const introOutline = `
      <section id="outline" style="padding:14px 16px;border-bottom:1px solid #e5e7eb">
        <p style="margin:0 0 8px;color:#374151">This weekly brief includes:</p>
        <div style="margin:0;display:flex;flex-wrap:wrap;gap:12px">
          <a href="#next-hack" style="display:inline-block;padding:0;color:#111827;text-decoration:underline;border-radius:0">Next Sundai Hack(s)</a>
          <span style="color:#9ca3af">|</span>
          <a href="#tools-club" style="display:inline-block;padding:0;color:#111827;text-decoration:underline;border-radius:0">AI Tools Club</a>
          <span style="color:#9ca3af">|</span>
          <a href="#community" style="display:inline-block;padding:0;color:#111827;text-decoration:underline;border-radius:0">Community News</a>
          <span style="color:#9ca3af">|</span>
          <a href="#ai-news" style="display:inline-block;padding:0;color:#111827;text-decoration:underline;border-radius:0">Weekly AI News</a>
          <span style="color:#9ca3af">|</span>
          <a href="#best-projects" style="display:inline-block;padding:0;color:#111827;text-decoration:underline;border-radius:0">Best Hacks of the Last Sundai</a>
        </div>
      </section>`;

    const nextHack = `
      <section id="next-hack" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <img src="https://www.sundai.club/icon.svg" alt="Sundai" width="28" height="28" style="display:inline-block;border-radius:0;border:1px solid #e5e7eb" />
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
          <a href="https://partiful.com/e/C3mnrNSv8YGnZefXcL0D" style="display:inline-block;padding:10px 14px;background:#111827;color:#ffffff;text-decoration:none;border-radius:0;border:1px solid #111827">RSVP on Partiful</a>
        </div>
      </section>`;

    const toolsClub = `
      <section id="tools-club" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <h2 style="margin:0 0 8px;font-size:18px;line-height:26px;color:#111827;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:20px;height:20px;border-radius:6px;background:#f3f4f6;border:1px solid #e5e7eb;text-align:center;line-height:20px;font-size:12px">🛠 </span> AI Tools Club, Tuesdays @ 5pm</h2>
        <ul style="margin:8px 0 0 18px;color:#374151;padding:0">
          <li>We discuss AI tools and frameworks every week</li>
          <li>Meets virtually on <a href="https://discord.com/invite/EVbrS8aEC9">Discord</a> </li>
          <li>Community toolbox - <a href="http://www.tiny.cc/sundai-toolbox">tiny.cc/sundai-toolbox</a></li>
          <li>Add it to your <a href="https://calendar.google.com/calendar/event?action=TEMPLATE&tmeid=N3U0bThmcTZjM2oxcjBiajU0djYxaG85bThfMjAyNTEwMTRUMjEwMDAwWiBiOTYwOGM1MWQ4Nzg0OGQzMGFhNmFiMzZkNjQ5MzJmOTIxNmZmZmM5NzZlMzQ4NzNkZjcxNWRjN2QyNDBiNjhiQGc&tmsrc=b9608c51d87848d30aa6ab36d64932f9216fffc976e34873df715dc7d240b68b%40group.calendar.google.com&scp=ALL">calendar </a></li>
          <li>[YouTube channel is coming]</li>

        </ul>
        <div style="margin-top:8px">
          <a href="https://partiful.com/e/xZtVjYqjTCVZQ2wlAjCg" style="display:inline-block;padding:10px 14px;background:#111827;color:#ffffff;text-decoration:none;border-radius:0;border:1px solid #111827">Join us Tuesdays @ 5pm</a>
        </div>
      </section>`;

    const communityNews = `
      <section id="community" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <h2 style="margin:0 0 8px;font-size:18px;line-height:26px;color:#111827;display:flex;align-items:center;gap:8px"> Community News</h2>
        <ul style="margin:8px 0 0 18px;color:#374151;padding:0">
          <li>Subscribe to <a href="https://calendar.google.com/calendar/u/0?cid=Yjk2MDhjNTFkODc4NDhkMzBhYTZhYjM2ZDY0OTMyZjkyMTZmZmZjOTc2ZTM0ODczZGY3MTVkYzdkMjQwYjY4YkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t">our calendar</a></li> to get all the events handy; </li>
          <li>Weekly Community Meeting - Tuesdays @8:30 - <a href="https://calendar.google.com/calendar/u/0?cid=Yjk2MDhjNTFkODc4NDhkMzBhYTZhYjM2ZDY0OTMyZjkyMTZmZmZjOTc2ZTM0ODczZGY3MTVkYzdkMjQwYjY4YkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t">calendar invite</a>  -- give us feedback, propose a new Sundai initiative;</li>
          <li>Get promoted to <a href="https://partiful.com/e/GZfEKvYQlIrk21mzx6Qe">#hacker role</a> - attend at least 4+ sundais</li>
          <li>Organize a <a href="https://partiful.com/e/iROjbe4j0PiKtaGop8SD">Sundai Hack as an MC</a> - get featured on our website</li>
          <li>Start <a href="https://partiful.com/e/dEh518Skq6MZqcXVNa3d">a chapter in your city</a>. Read our <a href="https://github.com/sergeicu/sundai-global">Constitution & Guide</a>. </li>

        </ul>
      </section>`;

    const fallbackAiNews = `
        <ul style="margin:8px 0 0 18px;color:#374151;padding:0">
          <li>GLM Coding plan is 10% off if you use the Vector Lab signup code</li>
          <li>OpenAI releases Chat with Apps, Agentkit, and more at Dev Day</li>
          <li>Qwen3 VL gets a small variant</li>
          <li>Can you give an LLM a gambling addiction</li>
          <li>And more in this week's news</li>
        </ul>
        <p style="margin:10px 0 0;color:#374151">Shoutout to Andrew for leading Sundai News.</p>
        <p style="margin:6px 0 0;color:#374151">Audio version available <a href="https://open.spotify.com/show/7LKYxvGAGSj1pso4aklh9O" style="color:#111827;text-decoration:underline">on Spotify</a>. Join the <a href="https://discord.gg/HrNXgwpVzd" style="color:#111827;text-decoration:underline">Discord</a>. Read the <a href="https://vectorlab.dev/weekly-10-6-to-10-12" style="color:#111827;text-decoration:underline">full article on the VectorLab website</a>.</p>`;

    const newsTLDR = `
      <section id="ai-news" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <h2 style="margin:0 0 8px;font-size:18px;line-height:26px;color:#111827">Weekly AI News · TL;DR</h2>
        ${aiNewsHtml && aiNewsHtml.trim().length > 0 ? aiNewsHtml : fallbackAiNews}
      </section>`;

    const projectsBlock = `
      <section id="best-projects" style="padding:20px 16px;border-bottom:1px solid #e5e7eb">
        <h2 style="margin:0 0 6px;font-size:18px;line-height:26px;color:#111827">Best hacks of last week</h2>
        <p style="margin:0 6px 6px 0;color:#374151">Voted by your likes — help great hacks trend.</p>
        ${projectsItems || `<p style=\"margin:0;color:#6b7280\">No projects this week.</p>`}
      </section>`;

    return `<!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta charSet="utf-8" />
        <title>Sundai Weekly</title>
        <style>
          body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; margin:0; background:#ffffff; }
          .container { max-width: 740px; margin: 0 auto; background:#ffffff; border: 1px solid #e5e7eb; }
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
          ${toolsClub}
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
      // Fetch TLDR HTML from VectorLab
      let aiNewsHtml: string | undefined = undefined;
      try {
        const tldrResp = await fetch('https://vectorlab.dev/api/tldr', { cache: 'no-store' });
        if (tldrResp.ok) {
          aiNewsHtml = await tldrResp.text();
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


