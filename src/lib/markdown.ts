export function normalizeProjectMarkdown(
  markdown: string | null | undefined
): string {
  if (!markdown || typeof markdown !== 'string') return '';

  return markdown.replace(
    /<(s|strike|del)\b[^>]*>([\s\S]*?)<\/\1>/gi,
    (_match, _tag, content) => {
      const text = String(content).trim();
      return text ? `~~${text}~~` : '';
    }
  );
}
