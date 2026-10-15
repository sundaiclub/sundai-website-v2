import { getAvailableWorkspaceSections } from '../../src/lib/eventWorkspace';

describe('event workspace sections', () => {
  it('includes RSVPs for admins and MCs with applicant-review access', () => {
    expect(getAvailableWorkspaceSections(true, false)).toContain(
      'registrations'
    );
  });

  it('omits only RSVPs for co-MCs without applicant-review access', () => {
    expect(getAvailableWorkspaceSections(false, false)).toEqual([
      'overview',
      'communications',
      'materials',
      'projects',
      'pitch',
      'notes',
      'reporting',
    ]);
  });

  it('includes check-in only when the event tracks attendance', () => {
    expect(getAvailableWorkspaceSections(false, false)).not.toContain(
      'checkIn'
    );
    expect(getAvailableWorkspaceSections(false, true)).toEqual([
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
