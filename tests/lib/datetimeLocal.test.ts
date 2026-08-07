import {
  formatDateTimeLocalValue,
  serializeDateTimeLocalValue,
} from '@/lib/datetimeLocal';

describe('datetimeLocal helpers', () => {
  it('keeps datetime-local values free of an implicit machine timezone', () => {
    const localValue = '2026-03-29T20:15';

    const serializedValue = serializeDateTimeLocalValue(localValue);

    expect(serializedValue).toBe(localValue);
  });

  it('formats an instant for the event timezone', () => {
    expect(
      formatDateTimeLocalValue('2026-07-10T17:00:00.000Z', 'America/New_York')
    ).toBe('2026-07-10T13:00');
  });

  it('returns empty output for missing or invalid values', () => {
    expect(formatDateTimeLocalValue(null)).toBe('');
    expect(formatDateTimeLocalValue('not-a-date')).toBe('');
    expect(serializeDateTimeLocalValue('')).toBeNull();
    expect(serializeDateTimeLocalValue('not-a-date')).toBeNull();
  });
});
