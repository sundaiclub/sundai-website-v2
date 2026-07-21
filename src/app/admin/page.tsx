'use client';

import Link from 'next/link';
import AdminAuthGate from './AdminAuthGate';
import {
  ManagementBackButton,
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
];

export default function AdminConsolePage() {
  const classes = useManagementClasses();
  const { isAdmin, loading, userInfo } = useUserContext();

  return (
    <ManagementPage>
      <AdminAuthGate
        isAdmin={isAdmin}
        isAuthenticated={Boolean(userInfo)}
        loading={loading}
      >
        <>
          <div className="mb-4">
            <ManagementBackButton />
          </div>
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
