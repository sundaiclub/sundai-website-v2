import { sanitizeApprovedDetailsJson } from '../../src/lib/approvedEventDetails';

describe('sanitizeApprovedDetailsJson', () => {
  it('removes retired approved-attendee fields and spelling variants', () => {
    expect(
      sanitizeApprovedDetailsJson({
        address: '42 Private Lane',
        details: 'Use the side entrance.',
        doorCode: 'retired access value',
        door_code: 'another retired access value',
        'Toolkit URL': 'https://example.com/retired-resource',
      })
    ).toEqual({
      address: '42 Private Lane',
      details: 'Use the side entrance.',
    });
  });

  it('preserves null and non-object JSON values', () => {
    expect(sanitizeApprovedDetailsJson(null)).toBeNull();
    expect(sanitizeApprovedDetailsJson('details')).toBe('details');
  });
});
