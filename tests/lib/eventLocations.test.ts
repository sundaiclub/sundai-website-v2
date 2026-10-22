import {
  collectEventLocationQuestions,
  matchesEventLocations,
  parseEventLocationConfig,
  selectedEventLocationIds,
  validateEventLocationAudience,
} from '@/lib/eventLocations';

const config = {
  questionId: 'venue',
  locations: [
    { id: 'boston', name: 'Boston', answerValues: ['BU', 'Boston University'] },
    { id: 'lowell', name: 'Lowell', answerValues: ['UMass Lowell'] },
  ],
};

describe('event message locations', () => {
  it('keeps choices removed from the application and observed historical answers', () => {
    expect(
      collectEventLocationQuestions(
        [
          {
            id: 'venue',
            label: 'Location',
            type: 'SELECT',
            options: [{ value: 'Lowell', label: 'Lowell campus' }],
          },
        ],
        [
          {
            templateSnapshotJson: [
              {
                id: 'venue',
                label: 'Old label',
                type: 'SELECT',
                options: [{ value: 'BU', label: 'Boston University' }],
              },
            ],
            answersJson: { venue: 'Northeastern' },
          },
          {
            templateSnapshotJson: null,
            answersJson: { venue: ['BU', 'Lowell'] },
          },
        ]
      )
    ).toEqual([
      {
        id: 'venue',
        label: 'Location',
        options: [
          { value: 'Lowell', label: 'Lowell campus' },
          { value: 'BU', label: 'Boston University' },
          { value: 'Northeastern', label: 'Northeastern' },
        ],
      },
    ]);
  });

  it('matches saved answer values and multiple selected locations without using labels or profile location', () => {
    expect(matchesEventLocations({ venue: 'BU' }, config, ['boston'])).toBe(
      true
    );
    expect(
      matchesEventLocations({ venue: ['Elsewhere', 'UMass Lowell'] }, config, [
        'boston',
        'lowell',
      ])
    ).toBe(true);
    expect(matchesEventLocations({ venue: 'Boston' }, config, ['boston'])).toBe(
      false
    );
    expect(matchesEventLocations({ location: 'BU' }, config, ['boston'])).toBe(
      false
    );
    expect(matchesEventLocations(null, config, ['boston'])).toBe(false);
  });

  it.each([[], null, 'boston', ['unknown'], ['boston', 'boston']])(
    'rejects invalid or unknown location selection %j',
    locationIds => {
      expect(
        validateEventLocationAudience({ locationIds }, 'APPROVED', config)
      ).not.toBeNull();
    }
  );

  it('allows all locations, rejects chapter member filters, and rejects missing configuration', () => {
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

  it('validates names, answer mappings, and unique groups', () => {
    expect(parseEventLocationConfig(config)).toEqual(config);
    expect(() =>
      parseEventLocationConfig({
        ...config,
        locations: [{ id: 'empty', name: 'Empty', answerValues: [] }],
      })
    ).toThrow();
    expect(() =>
      parseEventLocationConfig({
        ...config,
        locations: [
          config.locations[0],
          { id: 'other', name: 'Other', answerValues: ['BU'] },
        ],
      })
    ).toThrow(/only one location/);
    expect(() =>
      parseEventLocationConfig({
        ...config,
        locations: [
          config.locations[0],
          { id: 'other', name: 'boston', answerValues: ['Other'] },
        ],
      })
    ).toThrow(/unique/);
  });
});
