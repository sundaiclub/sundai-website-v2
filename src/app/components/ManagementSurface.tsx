'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTheme } from '../contexts/ThemeContext';

export type ManagementTone = 'default' | 'danger' | 'success' | 'warning';

function toneClasses(tone: ManagementTone, isDarkMode: boolean) {
  if (tone === 'danger') {
    return isDarkMode
      ? 'border-red-900/70 bg-red-950/50 text-red-100'
      : 'border-red-200 bg-red-50 text-red-900';
  }

  if (tone === 'success') {
    return isDarkMode
      ? 'border-emerald-900/70 bg-emerald-950/50 text-emerald-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }

  if (tone === 'warning') {
    return isDarkMode
      ? 'border-amber-900/70 bg-amber-950/50 text-amber-100'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  }

  return isDarkMode
    ? 'border-gray-800 bg-gray-900/80 text-gray-100'
    : 'border-gray-200 bg-white text-gray-900';
}

export function useManagementClasses() {
  const { isDarkMode } = useTheme();
  const mutedText = isDarkMode ? 'text-gray-400' : 'text-gray-600';

  return {
    isDarkMode,
    page: `${
      isDarkMode
        ? 'bg-gradient-to-b from-gray-950 via-gray-900 to-black text-gray-100'
        : 'bg-gradient-to-b from-[#E5E5E5] to-[#F4F4F4] text-gray-900'
    } font-space-mono min-h-screen`,
    panel: `${
      isDarkMode
        ? 'border-gray-800 bg-gray-900/80 text-gray-100 shadow-black/20'
        : 'border-gray-200 bg-white text-gray-900 shadow-gray-200/60'
    } rounded-lg border shadow-sm`,
    subtlePanel: `${
      isDarkMode
        ? 'border-gray-800 bg-gray-950/60 text-gray-100'
        : 'border-gray-200 bg-gray-50 text-gray-900'
    } rounded-lg border`,
    mutedText,
    divider: isDarkMode ? 'divide-gray-800' : 'divide-gray-200',
    input: `${
      isDarkMode
        ? 'border-gray-700 bg-gray-950 text-gray-100 placeholder:text-gray-500 focus:border-gray-400 disabled:bg-gray-900'
        : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-gray-900 disabled:bg-gray-100'
    } min-h-11 rounded-md border px-3 py-2 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70`,
    textarea: `${
      isDarkMode
        ? 'border-gray-700 bg-gray-950 text-gray-100 placeholder:text-gray-500 focus:border-gray-400 disabled:bg-gray-900'
        : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:border-gray-900 disabled:bg-gray-100'
    } min-h-32 rounded-md border px-3 py-2 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70`,
    checkbox: `${
      isDarkMode
        ? 'border-gray-700 bg-gray-950 text-gray-100'
        : 'border-gray-300 bg-white text-gray-900'
    } h-4 w-4 rounded border`,
    primaryButton: `${
      isDarkMode
        ? 'bg-gray-100 text-gray-900 hover:bg-gray-300'
        : 'bg-gray-900 text-white hover:bg-gray-700'
    } inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50`,
    secondaryButton: `${
      isDarkMode
        ? 'border-gray-700 text-gray-100 hover:bg-gray-800'
        : 'border-gray-300 text-gray-900 hover:bg-gray-50'
    } inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50`,
    ghostButton: `${
      isDarkMode
        ? 'text-gray-100 hover:bg-gray-800'
        : 'text-gray-900 hover:bg-gray-100'
    } inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition`,
  };
}

export function ManagementPage({
  children,
  maxWidth = 'max-w-6xl',
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  const classes = useManagementClasses();

  return (
    <main className={classes.page}>
      <div
        className={`${maxWidth} mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-20`}
      >
        {children}
      </div>
    </main>
  );
}

export function ManagementHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const classes = useManagementClasses();

  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div
            className={`mb-2 text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
          >
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {description && (
          <p
            className={`mt-3 max-w-3xl text-sm leading-6 ${classes.mutedText}`}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ManagementSection({
  children,
  title,
  description,
  actions,
}: {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const classes = useManagementClasses();

  return (
    <section className={`${classes.panel} p-4 sm:p-5`}>
      {(title || description || actions) && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h2 className="text-xl font-bold">{title}</h2>}
            {description && (
              <p className={`mt-1 text-sm leading-6 ${classes.mutedText}`}>
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function ManagementEmptyState({ children }: { children: ReactNode }) {
  const classes = useManagementClasses();

  return (
    <div
      className={`${classes.subtlePanel} px-4 py-6 text-center text-sm ${classes.mutedText}`}
    >
      {children}
    </div>
  );
}

export function ManagementBadge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: ManagementTone;
}) {
  const { isDarkMode } = useManagementClasses();

  return (
    <span
      className={`${toneClasses(tone, isDarkMode)} inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold`}
    >
      {children}
    </span>
  );
}

export function ManagementAlert({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: ManagementTone;
}) {
  const { isDarkMode } = useManagementClasses();

  return (
    <div
      className={`${toneClasses(tone, isDarkMode)} rounded-lg border px-4 py-3 text-sm`}
    >
      {children}
    </div>
  );
}

export function ManagementBackButton({
  fallbackHref = '/admin',
  label = 'Back',
}: {
  fallbackHref?: string;
  label?: string;
}) {
  const classes = useManagementClasses();

  function goBack() {
    if (typeof window === 'undefined') return;

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign(fallbackHref);
  }

  return (
    <button
      aria-label="Back to previous admin page"
      className={classes.ghostButton}
      onClick={goBack}
      type="button"
    >
      <span aria-hidden="true">&larr;</span>
      <span>{label}</span>
    </button>
  );
}

export function ManagementLinkButton({
  children,
  href,
  variant = 'secondary',
}: {
  children: ReactNode;
  href: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const classes = useManagementClasses();
  const className =
    variant === 'primary'
      ? classes.primaryButton
      : variant === 'ghost'
        ? classes.ghostButton
        : classes.secondaryButton;

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
