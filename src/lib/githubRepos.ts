export type GithubRepoRef = {
  owner: string;
  repo: string;
};

export type GithubRepoVisibility = 'public' | 'private' | 'unknown';

const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

export function parseGithubRepoUrl(
  value: string | null | undefined
): GithubRepoRef | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    );
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') return null;

  const [owner, rawRepo] = url.pathname.split('/').filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/i, '');
  if (!owner || !repo) return null;
  if (!NAME_PATTERN.test(owner) || !NAME_PATTERN.test(repo)) return null;

  return { owner, repo };
}

// Unauthenticated GitHub API requests return 404 for private repositories, so
// a 404 means the repository is private or does not exist.
export async function fetchGithubRepoVisibility(
  { owner, repo }: GithubRepoRef,
  signal?: AbortSignal
): Promise<GithubRepoVisibility> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers: { Accept: 'application/vnd.github+json' }, signal }
  );

  if (response.status === 404) return 'private';
  if (!response.ok) return 'unknown';

  const data = (await response.json()) as { private?: boolean };
  return data.private ? 'private' : 'public';
}
