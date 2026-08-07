const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export class EventDateTimeInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventDateTimeInputError';
  }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(item => item.type === type)?.value);

  return {
    year: part('year'),
    month: part('month'),
    day: part('day'),
    hour: part('hour'),
    minute: part('minute'),
    second: part('second'),
  };
}

function timezoneOffsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function assertTimezone(timeZone: unknown, fieldName: string) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) {
    throw new EventDateTimeInputError(`${fieldName} requires an IANA timezone`);
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    throw new EventDateTimeInputError('timezone must be a valid IANA timezone');
  }

  return timeZone;
}

/**
 * Parses an instant with an explicit offset, or interprets a datetime-local
 * value as wall-clock time in the supplied IANA timezone.
 */
export function parseEventDateTimeInput(
  value: unknown,
  timeZone: unknown,
  fieldName: string
) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new EventDateTimeInputError(`${fieldName} must be a date and time`);
  }

  if (EXPLICIT_OFFSET_PATTERN.test(value)) {
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) {
      throw new EventDateTimeInputError(
        `${fieldName} must be a valid date and time`
      );
    }
    return instant;
  }

  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    throw new EventDateTimeInputError(
      `${fieldName} must include an offset or use datetime-local format`
    );
  }

  const zone = assertTimezone(timeZone, fieldName);
  const [, year, month, day, hour, minute, second = '0', milliseconds = '0'] =
    match;
  const expected = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const localAsUtc = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
    expected.second,
    Number(milliseconds.padEnd(3, '0'))
  );
  let instant = new Date(localAsUtc);

  // Recalculate once because the first estimate can cross a DST boundary.
  instant = new Date(localAsUtc - timezoneOffsetMs(instant, zone));
  instant = new Date(localAsUtc - timezoneOffsetMs(instant, zone));

  const actual = zonedParts(instant, zone);
  if (
    Object.entries(expected).some(
      ([key, expectedValue]) =>
        actual[key as keyof typeof actual] !== expectedValue
    )
  ) {
    throw new EventDateTimeInputError(
      `${fieldName} does not exist in ${zone} because of a daylight-saving time change`
    );
  }

  return instant;
}

export function parseOptionalEventDateTimeInput(
  value: unknown,
  timeZone: unknown,
  fieldName: string
) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return parseEventDateTimeInput(value, timeZone, fieldName);
}
