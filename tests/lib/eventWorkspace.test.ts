import { getAvailableWorkspaceSections } from '../../src/lib/eventWorkspace';

describe('event workspace sections', () => {
  it('includes RSVPs for admins and MCs with applicant-review access', () => {
    expect(getAvailableWorkspaceSections(true, false, true)).toContain(
      'registrations'
    );
  });

  it('omits RSVPs and judging for co-MCs', () => {
    expect(getAvailableWorkspaceSections(false, false, false)).toEqual([
      'overview',
      'communications',
      'materials',
      'projects',
      'pitch',
      'notes',
      'reporting',
    ]);
  });

  it('includes judging for admins and MCs', () => {
    expect(getAvailableWorkspaceSections(true, false, true)).toEqual([
      'overview',
      'registrations',
      'communications',
      'materials',
      'projects',
      'pitch',
      'judging',
      'notes',
      'reporting',
    ]);
  });

  it('includes check-in only when the event tracks attendance', () => {
    expect(getAvailableWorkspaceSections(false, false, false)).not.toContain(
      'checkIn'
    );
    expect(getAvailableWorkspaceSections(false, true, false)).toEqual([
      'overview',
      'checkIn',
      'communications',
      'materials',
      'projects',
      'pitch',
      'notes',
      'reporting',
    ]);
  });
});
