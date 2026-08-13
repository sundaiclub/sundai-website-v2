import {
  parseEventApplicationMode,
  parseEventStaffAssignments,
  parseRegistrationSource,
  parseRegistrationStatus,
} from '@/lib/eventRequestParsing';

describe('event request parsing', () => {
  it('narrows supported event enum values without accepting arbitrary strings', () => {
    expect(parseEventApplicationMode('OPEN_RSVP')).toBe('OPEN_RSVP');
    expect(parseEventApplicationMode('PUBLIC_LATER')).toBeNull();
    expect(
      parseEventStaffAssignments([{ hackerId: ' hacker-1 ', role: 'MC' }])
    ).toEqual([{ hackerId: 'hacker-1', role: 'MC' }]);
    expect(
      parseEventStaffAssignments([{ hackerId: 'hacker-1', role: 'ADMIN' }])
    ).toBeNull();
  });

  it('parses registration statuses and preserves an explicit default', () => {
    expect(parseRegistrationStatus('WAITLISTED')).toBe('WAITLISTED');
    expect(parseRegistrationStatus(undefined, 'PENDING')).toBe('PENDING');
    expect(parseRegistrationStatus('ACCEPTED')).toBeNull();
    expect(parseRegistrationStatus(1)).toBeNull();
  });

  it('parses registration sources and rejects retired or malformed values', () => {
    expect(parseRegistrationSource('WEBSITE')).toBe('WEBSITE');
    expect(parseRegistrationSource(undefined, 'INTERNAL')).toBe('INTERNAL');
    expect(parseRegistrationSource('PUBLIC_LATER')).toBeNull();
    expect(parseRegistrationSource({ source: 'WEBSITE' })).toBeNull();
  });
});
