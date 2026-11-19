'use client';
import React, { useEffect, useState } from 'react';
import {
  fetchGithubRepoVisibility,
  parseGithubRepoUrl,
} from '@/lib/githubRepos';

type RepoWarning = 'not-repo' | 'private' | null;

const CHECK_DELAY_MS = 600;

const WARNING_MESSAGES: Record<Exclude<RepoWarning, null>, string> = {
  'not-repo':
    'This link does not point to a repository. Use a URL like github.com/owner/repo.',
  private:
    'Your GitHub project cannot be found or is private. Check the URL and the repository access settings.',
};

export default function GithubRepoStatus({
  url,
  isDarkMode,
}: {
  url: string;
  isDarkMode: boolean;
}) {
  const [warning, setWarning] = useState<RepoWarning>(null);

  useEffect(() => {
    setWarning(null);
    if (!url.trim().toLowerCase().includes('github.com')) return;

    const repoRef = parseGithubRepoUrl(url);
    if (!repoRef) {
      setWarning('not-repo');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchGithubRepoVisibility(repoRef, controller.signal)
        .then(visibility => {
          if (visibility === 'private') setWarning('private');
        })
        .catch(error => {
          if (!controller.signal.aborted) {
            console.error('Failed to check GitHub repository:', error);
          }
        });
    }, CHECK_DELAY_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url]);

  if (!warning) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className={`text-sm ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}
    >
      {WARNING_MESSAGES[warning]}
    </p>
  );
}
