import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Projects | Sundai Club',
  description: 'Explore projects built by the Sundai Club community.',
};

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
