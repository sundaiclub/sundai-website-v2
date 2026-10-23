export const GITHUB_URL_REQUIRED_MESSAGE =
  'GitHub link is required. Enter a URL that contains github.com.';

export function meetsGithubUrlRequirement(value: string | null | undefined) {
  return Boolean(value?.trim().toLowerCase().includes('github.com'));
}
