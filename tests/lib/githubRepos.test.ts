import {
  fetchGithubRepoVisibility,
  parseGithubRepoUrl,
} from '@/lib/githubRepos';

describe('GitHub repository URL parsing', () => {
  it.each([
    ['https://github.com/sundai/website', { owner: 'sundai', repo: 'website' }],
    ['github.com/sundai/website', { owner: 'sundai', repo: 'website' }],
    [' www.github.com/sundai/website ', { owner: 'sundai', repo: 'website' }],
    [
      'https://github.com/sundai/website.git',
      { owner: 'sundai', repo: 'website' },
    ],
    [
      'https://github.com/sundai/web.site/tree/main/src',
      { owner: 'sundai', repo: 'web.site' },
    ],
  ])('parses %s', (input, expected) => {
    expect(parseGithubRepoUrl(input)).toEqual(expected);
  });

  it.each([
    '',
    null,
    'https://github.com',
    'https://github.com/sundai',
    'https://gitlab.com/sundai/website',
    'https://github.com.evil.example/sundai/website',
    'not a url',
  ])('rejects %s', input => {
    expect(parseGithubRepoUrl(input)).toBeNull();
  });
});

describe('GitHub repository visibility', () => {
  const originalFetch = global.fetch;
  const repoRef = { owner: 'sundai', repo: 'website' };

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(status: number, body: unknown = {}) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('reports a public repository', async () => {
    const fetchMock = mockFetch(200, { private: false });
    await expect(fetchGithubRepoVisibility(repoRef)).resolves.toBe('public');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/sundai/website',
      expect.any(Object)
    );
  });

  it('reports a 404 as private', async () => {
    mockFetch(404);
    await expect(fetchGithubRepoVisibility(repoRef)).resolves.toBe('private');
  });

  it('reports a repository marked private as private', async () => {
    mockFetch(200, { private: true });
    await expect(fetchGithubRepoVisibility(repoRef)).resolves.toBe('private');
  });

  it('reports rate limits as unknown', async () => {
    mockFetch(403);
    await expect(fetchGithubRepoVisibility(repoRef)).resolves.toBe('unknown');
  });
});
