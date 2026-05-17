'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeProjectMarkdown } from '@/lib/markdown';

type ProjectMarkdownProps = {
  markdown: string | null | undefined;
  className?: string;
};

export default function ProjectMarkdown({
  markdown,
  className,
}: ProjectMarkdownProps) {
  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {normalizeProjectMarkdown(markdown)}
    </ReactMarkdown>
  );
}
