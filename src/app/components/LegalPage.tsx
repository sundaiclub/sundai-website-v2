'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useManagementClasses } from './ManagementSurface';

export function LegalPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const classes = useManagementClasses();

  return (
    <main className={classes.page}>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="mb-8 border-b pb-8 sm:mb-10 sm:pb-10">
          <p
            className={`mb-3 text-xs font-bold uppercase tracking-widest ${classes.mutedText}`}
          >
            Sundai Club legal
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
          <p
            className={`mt-4 max-w-3xl text-sm leading-6 ${classes.mutedText}`}
          >
            {description}
          </p>
          <p className={`mt-3 text-xs ${classes.mutedText}`}>
            Effective and last updated: August 4, 2026
          </p>
        </header>

        <article
          className={`${classes.panel} space-y-8 p-5 text-sm leading-7 sm:p-8 [&_a]:font-semibold [&_a]:text-indigo-600 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_li]:pl-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-3 [&_ul]:ml-5 [&_ul]:list-disc`}
        >
          {children}
        </article>

        <nav
          aria-label="Legal pages"
          className={`mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm ${classes.mutedText}`}
        >
          <Link
            className="font-semibold underline underline-offset-4"
            href="/privacy"
          >
            Privacy Policy
          </Link>
          <Link
            className="font-semibold underline underline-offset-4"
            href="/terms"
          >
            Terms of Service
          </Link>
          <Link className="font-semibold underline underline-offset-4" href="/">
            Return home
          </Link>
        </nav>
      </div>
    </main>
  );
}
