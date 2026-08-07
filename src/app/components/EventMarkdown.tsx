'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type EventMarkdownProps = {
  markdown: string | null | undefined;
  className?: string;
};

export default function EventMarkdown({
  markdown,
  className,
}: EventMarkdownProps) {
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
      {markdown || ''}
    </ReactMarkdown>
  );
}
