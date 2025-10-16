export function markdownToHtml(markdown: string): string {
  if (!markdown || typeof markdown !== 'string') return '';

  // Normalize newlines
  const lines = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  const htmlParts: string[] = [];
  let inList = false;

  const flushList = () => {
    if (inList) {
      htmlParts.push('</ul>');
      inList = false;
    }
  };

  const renderInline = (text: string): string => {
    // Basic link: [label](url)
    return text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, (_m, label, url) => {
      const safeLabel = String(label);
      const safeUrl = String(url);
      return `<a href="${safeUrl}" style="color:#111827;text-decoration:underline">${safeLabel}</a>`;
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      flushList();
      continue;
    }

    // Bullet list item: - text OR * text
    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        htmlParts.push('<ul style="margin:8px 0 0 18px;color:#374151;padding:0">');
        inList = true;
      }
      htmlParts.push(`<li>${renderInline(listMatch[1])}</li>`);
      continue;
    }

    // Heading (very simple): treat as strong paragraph
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      flushList();
      htmlParts.push(`<p style="margin:0 0 8px"><strong>${renderInline(headingMatch[1])}</strong></p>`);
      continue;
    }

    // Paragraph
    flushList();
    htmlParts.push(`<p style="margin:0 0 8px;color:#374151">${renderInline(line)}</p>`);
  }

  flushList();
  return htmlParts.join('');
}

export default markdownToHtml;


