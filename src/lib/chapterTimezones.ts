export const CHAPTER_TIMEZONE_GROUPS = [
  {
    label: 'United States',
    options: [
      { value: 'America/New_York', label: 'Eastern' },
      { value: 'America/Chicago', label: 'Central' },
      { value: 'America/Denver', label: 'Mountain' },
      { value: 'America/Los_Angeles', label: 'Pacific (Western)' },
    ],
  },
  {
    label: 'Europe',
    options: [
      { value: 'Europe/London', label: 'London' },
      { value: 'Europe/Dublin', label: 'Dublin' },
      { value: 'Europe/Lisbon', label: 'Lisbon' },
      { value: 'Europe/Paris', label: 'Paris' },
      { value: 'Europe/Berlin', label: 'Berlin' },
      { value: 'Europe/Madrid', label: 'Madrid' },
      { value: 'Europe/Rome', label: 'Rome' },
      { value: 'Europe/Amsterdam', label: 'Amsterdam' },
      { value: 'Europe/Brussels', label: 'Brussels' },
      { value: 'Europe/Zurich', label: 'Zurich' },
      { value: 'Europe/Vienna', label: 'Vienna' },
      { value: 'Europe/Prague', label: 'Prague' },
      { value: 'Europe/Warsaw', label: 'Warsaw' },
      { value: 'Europe/Stockholm', label: 'Stockholm' },
      { value: 'Europe/Oslo', label: 'Oslo' },
      { value: 'Europe/Copenhagen', label: 'Copenhagen' },
      { value: 'Europe/Athens', label: 'Athens' },
      { value: 'Europe/Bucharest', label: 'Bucharest' },
      { value: 'Europe/Helsinki', label: 'Helsinki' },
      { value: 'Europe/Kyiv', label: 'Kyiv' },
      { value: 'Europe/Istanbul', label: 'Istanbul' },
    ],
  },
] as const;

const CHAPTER_TIMEZONES: ReadonlySet<string> = new Set(
  CHAPTER_TIMEZONE_GROUPS.flatMap(group =>
    group.options.map(option => option.value)
  )
);

export function isChapterTimezone(value: unknown): value is string {
  return typeof value === 'string' && CHAPTER_TIMEZONES.has(value);
}
