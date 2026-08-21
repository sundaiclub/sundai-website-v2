import { auth } from '@clerk/nextjs/server';

export default async function AuthenticatedPageLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await auth.protect();
  return children;
}
