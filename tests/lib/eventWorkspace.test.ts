import { getAvailableWorkspaceSections } from '../../src/lib/eventWorkspace';

describe('event workspace sections', () => {
  it('includes RSVPs for admins and MCs with applicant-review access', () => {
    expect(getAvailableWorkspaceSections(true)).toContain('registrations');
  });

  it('omits only RSVPs for co-MCs without applicant-review access', () => {
    expect(getAvailableWorkspaceSections(false)).toEqual([
      'overview',
      'communications',
      'materials',
      'projects',
      'pitch',
      'notes',
      'reporting',
    ]);
  });
});
