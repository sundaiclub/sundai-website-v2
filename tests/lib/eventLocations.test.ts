import {
  matchesEventLocations,
  parseEventLocationConfig,
  selectedEventLocationIds,
  validateEventLocationAudience,
} from '@/lib/eventLocations';

const config = {
  locations: [
    { id: 'boston', name: 'Boston University (BU)' },
    { id: 'lowell', name: 'UMass Lowell' },
  ],
};

describe('independent event message locations', () => {
  it('accepts arbitrary location names without a question or answer mapping', () => {
    expect(parseEventLocationConfig(config)).toEqual(config);
    expect(parseEventLocationConfig({ locations: [] })).toEqual({
      locations: [],
    });
    expect(() =>
      parseEventLocationConfig({ locations: [{ id: 'blank', name: ' ' }] })
    ).toThrow(/needs a name/);
    expect(() =>
      parseEventLocationConfig({
        locations: [
          config.locations[0],
          { id: 'duplicate', name: ' boston   university (BU) ' },
        ],
      })
    ).toThrow(/unique/);
  });

  it('matches full venues using saved answers without consulting current choices', () => {
    expect(
      matchesEventLocations(
        { 'pick-your-hackachusetts-location': 'Boston University (BU)' },
        config,
        ['boston'],
        null
      )
    ).toBe(true);
    expect(
      matchesEventLocations(
        { venue: ['Elsewhere', 'UMass Lowell'] },
        config,
        ['boston', 'lowell'],
        null
      )
    ).toBe(true);
    expect(
      matchesEventLocations({ venue: 'UMass Lowell' }, config, ['boston'], null)
    ).toBe(false);
    expect(matchesEventLocations(null, config, ['boston'], null)).toBe(false);
  });

  it('matches a saved option label when the stored value is an ID', () => {
    const snapshot = [
      {
        id: 'question-123',
        label: 'Pick your event location',
        options: [{ value: 'bu', label: 'Boston University (BU)' }],
      },
    ];
    expect(
      matchesEventLocations(
        { 'question-123': 'bu' },
        config,
        ['boston'],
        snapshot
      )
    ).toBe(true);
    expect(
      matchesEventLocations(
        { 'question-123': 'lowell' },
        config,
        ['boston'],
        snapshot
      )
    ).toBe(false);
  });

  it('does not match unrelated application answers or partial location names', () => {
    expect(
      matchesEventLocations(
        { university: 'Boston University (BU)' },
        config,
        ['boston'],
        [{ id: 'university', label: 'University / College' }]
      )
    ).toBe(false);
    expect(
      matchesEventLocations(
        { venue: 'Boston University (BU) annex' },
        config,
        ['boston'],
        null
      )
    ).toBe(false);
  });

  it('ignores differences in case, whitespace, and curly apostrophes', () => {
    expect(
      matchesEventLocations(
        { eventLocation: '  MIT’s  The Engine ' },
        { locations: [{ id: 'mit', name: "MIT's The Engine" }] },
        ['mit'],
        null
      )
    ).toBe(true);
  });

  it.each([[], null, 'boston', ['unknown'], ['boston', 'boston']])(
    'rejects invalid or unknown selections %j',
    locationIds => {
      expect(
        validateEventLocationAudience({ locationIds }, 'APPROVED', config)
      ).not.toBeNull();
    }
  );

  it('allows all locations and rejects chapter-member location filters', () => {
    expect(selectedEventLocationIds({})).toBeUndefined();
    expect(validateEventLocationAudience({}, 'APPROVED', null)).toBeNull();
    expect(
      validateEventLocationAudience(
        { locationIds: ['boston'] },
        'CHAPTER_MEMBERS',
        config
      )
    ).not.toBeNull();
    expect(
      validateEventLocationAudience(
        { locationIds: ['boston'] },
        'APPROVED',
        null
      )
    ).not.toBeNull();
  });
});
