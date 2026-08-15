export const PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.sundai.club';

export const DEFAULT_SOCIAL_IMAGE_URL = new URL(
  '/images/sundai-social-card.png',
  PUBLIC_APP_URL
).toString();
