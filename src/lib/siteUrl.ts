export const PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.sundai.club';

export function publicUrl(pathname: string): string {
  return new URL(pathname, PUBLIC_APP_URL).toString();
}

export const DEFAULT_SOCIAL_IMAGE_URL = publicUrl(
  '/images/sundai-social-card.png?v=2'
);
