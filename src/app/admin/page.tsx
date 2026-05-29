'use client';

import Link from 'next/link';
import AdminAuthGate from './AdminAuthGate';
import {
  ManagementHeader,
  ManagementPage,
  useManagementClasses,
} from '../components/ManagementSurface';
import { useUserContext } from '../contexts/UserContext';

const adminSections = [
  { href: '/admin/projects', label: 'Project moderation' },
  { href: '/admin/chapters', label: 'Chapters' },
  { href: '/admin/application-templates', label: 'Application templates' },
  { href: '/admin/bans', label: 'Global moderation' },
  { href: '/organizer/events', label: 'Organizer events' },
];

export default function AdminConsolePage() {
  const classes = useManagementClasses();
  const { isAdmin, loading } = useUserContext();

  return (
    <ManagementPage>
      <AdminAuthGate isAdmin={isAdmin} loading={loading}>
        <>
          <ManagementHeader
            eyebrow="Site admin"
            title="Site admin console"
            description="Moderate projects, chapters, application templates, and global safety controls."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adminSections.map(section => (
              <Link
                key={section.href}
                href={section.href}
                className={`${classes.panel} p-5 transition hover:-translate-y-0.5 hover:shadow-md`}
              >
                <span className="font-semibold">{section.label}</span>
              </Link>
            ))}
          </div>
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
