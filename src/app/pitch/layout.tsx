import React from 'react';
import type { Metadata } from 'next';
import AuthenticatedPageLayout from '../AuthenticatedPageLayout';

export const metadata: Metadata = {
  title: 'Pitch | Sundai Club',
  description: "Join an event's live pitch queue and follow project pitches.",
};

export default function PitchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedPageLayout>{children}</AuthenticatedPageLayout>;
}
