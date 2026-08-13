import {
  parseNonNegativeInteger,
  parsePageSize,
} from '../../src/lib/pagination';

describe('pagination parsing', () => {
  it('parses non-negative integers and uses the default only when absent', () => {
    expect(parseNonNegativeInteger(null, 50)).toBe(50);
    expect(parseNonNegativeInteger('0', 50)).toBe(0);
    expect(parseNonNegativeInteger('12', 50)).toBe(12);
    expect(parseNonNegativeInteger('-1', 50)).toBeNull();
    expect(parseNonNegativeInteger('1.5', 50)).toBeNull();
    expect(parseNonNegativeInteger('invalid', 50)).toBeNull();
  });

  it('parses and bounds positive page sizes', () => {
    expect(parsePageSize(null, 20, 50)).toBe(20);
    expect(parsePageSize('', 20, 50)).toBe(20);
    expect(parsePageSize('12', 20, 50)).toBe(12);
    expect(parsePageSize('100', 20, 50)).toBe(50);
    expect(parsePageSize('0', 20, 50)).toBeNull();
    expect(parsePageSize('-1', 20, 50)).toBeNull();
    expect(parsePageSize('1.5', 20, 50)).toBeNull();
  });
});
