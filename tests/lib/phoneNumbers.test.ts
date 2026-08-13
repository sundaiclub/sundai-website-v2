import {
  normalizeSmsPhoneNumber,
  phoneNumberForStorage,
  phoneNumberLookupCandidates,
} from '../../src/lib/phoneNumbers';

describe('phone number normalization', () => {
  it('defaults plain US numbers to country code +1', () => {
    expect(normalizeSmsPhoneNumber('5086485700')).toBe('+15086485700');
    expect(normalizeSmsPhoneNumber('(508) 648-5700')).toBe('+15086485700');
    expect(normalizeSmsPhoneNumber('1-508-648-5700')).toBe('+15086485700');
  });

  it('preserves valid international E.164 numbers', () => {
    expect(normalizeSmsPhoneNumber('+442071838750')).toBe('+442071838750');
  });

  it('does not infer a country for other invalid values', () => {
    expect(normalizeSmsPhoneNumber('555-0101')).toBeNull();
    expect(phoneNumberForStorage('555-0101')).toBe('555-0101');
  });

  it('provides legacy US forms for inbound STOP matching', () => {
    expect(phoneNumberLookupCandidates('+15086485700')).toEqual([
      '+15086485700',
      '15086485700',
      '5086485700',
    ]);
  });
});
