import {
  communicationStats,
  fiveWordExcerpt,
} from '../../src/lib/adminCommunications';

describe('admin communications', () => {
  it('uses only the first five words for the list excerpt', () => {
    expect(fiveWordExcerpt('One two three four five six seven')).toBe(
      'One two three four five…'
    );
    expect(fiveWordExcerpt('  One\n two three  ')).toBe('One two three');
  });

  it('groups recipient delivery states for report statistics', () => {
    expect(
      communicationStats([
        'PENDING',
        'SENDING',
        'SENT',
        'DELIVERED',
        'UNDELIVERED',
        'FAILED',
      ])
    ).toEqual({
      total: 6,
      pending: 2,
      accepted: 1,
      delivered: 1,
      failed: 2,
    });
  });
});
