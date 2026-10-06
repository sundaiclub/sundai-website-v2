export type CopiedImage = {
  key: string;
  size: number;
  md5: string;
  contentType: string;
};

export function imagePublicUrl(baseUrl: string, key: string) {
  return `${baseUrl.replace(/\/$/, '')}/${key
    .split('/')
    .map(segment =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
      )
    )
    .join('/')}`;
}

export function rewriteImageReferences(
  input: unknown,
  sourceBucket: string,
  baseUrl: string,
  copiedImages: ReadonlyMap<string, CopiedImage>
) {
  const keys = new Set<string>();
  const unresolved = new Set<string>();
  const escapedBucket = sourceBucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `https?://storage\\.googleapis\\.com/${escapedBucket}/[^\\s<>"'\\)\\]]+`,
    'g'
  );
  function rewrite(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(pattern, match => {
        let candidate = match;
        let key: string | undefined;
        while (candidate) {
          try {
            key = decodeURIComponent(
              new URL(candidate).pathname.slice(sourceBucket.length + 2)
            );
          } catch {
            break;
          }
          if (copiedImages.has(key)) {
            keys.add(key);
            return imagePublicUrl(baseUrl, key) + match.slice(candidate.length);
          }
          if (!/[.,;:!?]$/.test(candidate)) break;
          candidate = candidate.slice(0, -1);
        }
        unresolved.add(match);
        return match;
      });
    }
    if (Array.isArray(value)) return value.map(rewrite);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, rewrite(item)])
      );
    }
    return value;
  }
  return {
    value: rewrite(input),
    keys: Array.from(keys),
    unresolved: Array.from(unresolved),
  };
}
