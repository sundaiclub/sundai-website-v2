"use client";

import { useEffect, useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserContext } from "../../contexts/UserContext";

type Ban = {
  id: string;
  hackerId: string;
  publicSafeReason: string;
  publicReason?: string;
  revokedAt: string | null;
  hackerName?: string;
  hacker?: { name: string | null; email: string | null };
};

type BanFlag = {
  id: string;
  hackerName?: string;
  reason: string;
  status: string;
};

function banList(payload: unknown): Ban[] {
  if (Array.isArray(payload)) return payload as Ban[];
  if (payload && typeof payload === "object") {
    const value = payload as { bans?: Ban[]; items?: Ban[] };
    return value.bans ?? value.items ?? [];
  }
  return [];
}

function flagList(payload: unknown): BanFlag[] {
  if (Array.isArray(payload)) return payload as BanFlag[];
  if (payload && typeof payload === "object") {
    const value = payload as { banFlags?: BanFlag[]; flags?: BanFlag[]; items?: BanFlag[] };
    return value.banFlags ?? value.flags ?? value.items ?? [];
  }
  return [];
}

export default function AdminBansPage() {
  const { isDarkMode } = useTheme();
  const { isAdmin } = useUserContext();
  const [bans, setBans] = useState<Ban[]>([]);
  const [flags, setFlags] = useState<BanFlag[]>([]);
  const [hackerId, setHackerId] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/bans")
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => setBans(banList(payload)))
      .catch(() => setBans([]));
    fetch("/api/admin/ban-flags")
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => setFlags(flagList(payload)))
      .catch(() => setFlags([]));
  }, [isAdmin]);

  async function createBan(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/bans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hackerId }),
    });
    if (response.ok) {
      const created = await response.json();
      setBans((current) => [created, ...current]);
      setHackerId("");
    }
  }

  return (
    <main
      className={`${
        isDarkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"
      } font-space-mono min-h-screen`}
    >
      <div className="max-w-6xl mx-auto px-4 py-20">
        {isAdmin ? (
          <>
            <h1 className="text-3xl font-bold mb-6">Global moderation</h1>
            <form onSubmit={createBan} className="flex gap-3 mb-8">
              <input
                aria-label="Search hacker"
                className="border rounded px-3 py-2 text-gray-900 min-w-0 flex-1"
                value={hackerId}
                onChange={(event) => setHackerId(event.target.value)}
                placeholder="Hacker ID"
              />
              <button className="border rounded px-4 py-2 font-semibold" type="submit">
                Create ban
              </button>
            </form>
            <div className="divide-y">
              {bans.map((ban) => (
                <div key={ban.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      {ban.hacker?.name || ban.hackerName || ban.hackerId}
                    </div>
                    <div className="text-sm opacity-70">{ban.publicSafeReason || ban.publicReason}</div>
                  </div>
                  <button className="text-sm border rounded px-3 py-1" type="button">
                    Revoke
                  </button>
                </div>
              ))}
            </div>
            <h2 className="text-xl font-bold mt-8 mb-3">Ban flags</h2>
            <div className="divide-y">
              {flags.map((flag) => (
                <div key={flag.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{flag.hackerName || flag.id}</div>
                    <div className="text-sm opacity-70">{flag.reason}</div>
                  </div>
                  <button className="text-sm border rounded px-3 py-1" type="button">
                    Resolve
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center text-red-500">
            You do not have permission to view this page.
          </div>
        )}
      </div>
    </main>
  );
}
