const GOOGLE_SLIDES_PATH =
  /^\/presentation\/d\/(e\/)?([A-Za-z0-9_-]+)(?:\/(?:edit|view|pub|embed|present|preview)?)?\/?$/;

/**
 * Turns a shared Google Slides link into its embeddable slideshow URL. Other
 * HTTPS links are embedded as they are.
 */
export function guideEmbedUrl(guideUrl: string): string {
  const url = new URL(guideUrl);
  const slides =
    url.hostname === 'docs.google.com'
      ? url.pathname.match(GOOGLE_SLIDES_PATH)
      : null;
  if (!slides) return url.toString();

  const [, published, id] = slides;
  return `https://docs.google.com/presentation/d/${published ?? ''}${id}/embed?start=false&loop=false&delayms=3000`;
}
