'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';

type StaffRole = 'MC' | 'CO_MC';
type StaffMember = {
  id: string;
  hackerId: string;
  name?: string;
  role: StaffRole;
  hacker?: { id: string; name: string; email?: string | null };
};
type StaffAudit = {
  id: string;
  action: 'ASSIGNED' | 'ROLE_CHANGED' | 'REMOVED';
  fromRole?: StaffRole | null;
  toRole?: StaffRole | null;
  createdAt: string;
  staffHacker?: { id: string; name: string };
  actor?: { id: string; name: string };
};

export default function EventStaffPanel({
  eventId,
  canAssignStaff,
  initialStaff = [],
}: {
  eventId: string;
  canAssignStaff: boolean;
  initialStaff?: StaffMember[];
}) {
  const classes = useManagementClasses();
  const [staff, setStaff] = useState(initialStaff);
  const [loading, setLoading] = useState(true);
  const [showAssignment, setShowAssignment] = useState(false);
  const [hackerId, setHackerId] = useState('');
  const [role, setRole] = useState<StaffRole>('MC');
  const [audits, setAudits] = useState<StaffAudit[] | null>(null);
  const [notice, setNotice] = useState('');
  const assignStaffButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let current = true;
    fetch(`/api/events/${eventId}/staff`)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load staff');
        return response.json();
      })
      .then(payload => {
        if (current) setStaff(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        if (current) setNotice('Event staff are unavailable.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [eventId]);

  async function saveAssignment(targetHackerId: string, targetRole: StaffRole) {
    setNotice('');
    const response = await fetch(`/api/events/${eventId}/staff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hackerId: targetHackerId, role: targetRole }),
    });
    if (!response.ok) {
      setNotice('Unable to update event staff.');
      return;
    }
    const saved = (await response.json()) as StaffMember;
    setStaff(current => {
      const exists = current.some(member => member.hackerId === saved.hackerId);
      return exists
        ? current.map(member =>
            member.hackerId === saved.hackerId ? saved : member
          )
        : [...current, saved];
    });
    setHackerId('');
    setRole('MC');
    setShowAssignment(false);
    setNotice('Event staff updated.');
  }

  async function removeStaff(member: StaffMember) {
    const name = member.name ?? member.hacker?.name ?? 'this organizer';
    if (!window.confirm(`Remove ${name} from this event?`)) return;
    const response = await fetch(`/api/events/${eventId}/staff/${member.id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setNotice('Unable to remove event staff.');
      return;
    }
    setStaff(current => current.filter(row => row.id !== member.id));
    setNotice('Event staff removed. Access is revoked immediately.');
    assignStaffButtonRef.current?.focus();
  }

  async function loadAudits() {
    const response = await fetch(`/api/events/${eventId}/staff/audits`);
    if (!response.ok) {
      setNotice('Staff audit history is unavailable.');
      return;
    }
    const payload = await response.json();
    setAudits(Array.isArray(payload) ? payload : (payload.items ?? []));
  }

  return (
    <ManagementSection
      title="Event staff"
      description="MC and co-MC assignments grant operational access to this event."
      actions={
        canAssignStaff ? (
          <>
            <button
              aria-label="Add staff"
              className={classes.primaryButton}
              onClick={() => setShowAssignment(value => !value)}
              ref={assignStaffButtonRef}
              type="button"
            >
              Assign staff
            </button>
            <button
              className={classes.secondaryButton}
              onClick={loadAudits}
              type="button"
            >
              Staff audit history
            </button>
          </>
        ) : undefined
      }
    >
      {notice && (
        <ManagementAlert
          tone={notice.startsWith('Unable') ? 'danger' : 'success'}
        >
          <span role="status">{notice}</span>
        </ManagementAlert>
      )}

      {showAssignment && canAssignStaff && (
        <div
          className={`${classes.subtlePanel} mt-4 grid gap-3 p-4 sm:grid-cols-2`}
        >
          <label>
            <span className="mb-1 block text-sm font-bold">
              Hacker / organizer
            </span>
            <input
              className={classes.input}
              onChange={event => setHackerId(event.target.value)}
              placeholder="Hacker ID"
              value={hackerId}
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold">Staff role</span>
            <select
              className={classes.input}
              onChange={event => setRole(event.target.value as StaffRole)}
              value={role}
            >
              <option value="MC">MC role</option>
              <option value="CO_MC">Co-MC role</option>
            </select>
          </label>
          <button
            className={classes.primaryButton}
            disabled={!hackerId.trim()}
            onClick={() => saveAssignment(hackerId.trim(), role)}
            type="button"
          >
            Assign
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {staff.map(member => {
          const name = member.name ?? member.hacker?.name ?? member.hackerId;
          return (
            <div
              className={`${classes.subtlePanel} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}
              key={member.id}
            >
              <div>
                <p className="font-bold">{name}</p>
                <ManagementBadge>
                  {member.role === 'CO_MC' ? 'Co-MC' : 'MC'}
                </ManagementBadge>
              </div>
              {canAssignStaff && (
                <div className="flex flex-wrap gap-2">
                  <label>
                    <select
                      aria-label={`Change assignment for ${name}`}
                      className={classes.input}
                      onChange={event =>
                        saveAssignment(
                          member.hackerId,
                          event.target.value as StaffRole
                        )
                      }
                      value={member.role}
                    >
                      <option value="MC">MC role</option>
                      <option value="CO_MC">Co-MC role</option>
                    </select>
                  </label>
                  <button
                    aria-label={`Remove ${name}`}
                    className={classes.secondaryButton}
                    onClick={() => removeStaff(member)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!loading && staff.length === 0 && (
          <ManagementEmptyState>
            No event staff are assigned.
          </ManagementEmptyState>
        )}
      </div>

      {canAssignStaff && audits && (
        <div className="mt-5">
          <h3 className="font-bold">Immutable staff audit history</h3>
          <div className="mt-3 grid gap-2">
            {audits.map(audit => (
              <div
                className={`${classes.subtlePanel} p-3 text-sm`}
                key={audit.id}
              >
                <p
                  aria-label={`${audit.action} ${audit.staffHacker?.name ?? 'Organizer'} by ${audit.actor?.name ?? 'Administrator'}`}
                >
                  <span className="font-bold">{audit.action}</span> Staff member
                  by <span>{audit.actor?.name ?? 'Administrator'}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {audit.fromRole && (
                    <ManagementBadge>
                      From role: {audit.fromRole}
                    </ManagementBadge>
                  )}
                  {audit.toRole && (
                    <ManagementBadge>To role: {audit.toRole}</ManagementBadge>
                  )}
                  <time dateTime={audit.createdAt}>
                    {new Date(audit.createdAt).toLocaleTimeString()}
                  </time>
                </div>
              </div>
            ))}
            {audits.length === 0 && (
              <ManagementEmptyState>
                No staff changes recorded.
              </ManagementEmptyState>
            )}
          </div>
        </div>
      )}
    </ManagementSection>
  );
}
