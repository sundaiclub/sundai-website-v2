export type EventCommunicationLocation = {
  id: string;
  name: string;
};

export type EventLocationConfig = {
  locations: EventCommunicationLocation[];
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLocationName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[‘’]/g, "'")
    .toLowerCase();
}

export function parseEventLocationConfig(
  value: unknown
): EventLocationConfig | null {
  if (value == null) return null;
  if (
    !record(value) ||
    !Array.isArray(value.locations) ||
    value.locations.length > 100
  ) {
    throw new Error('Enter a list of up to 100 event locations.');
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  const locations = value.locations.map(location => {
    if (
      !record(location) ||
      typeof location.id !== 'string' ||
      !location.id.trim() ||
      location.id.length > 100 ||
      typeof location.name !== 'string' ||
      !location.name.trim() ||
      location.name.length > 200
    ) {
      throw new Error('Each location needs a name.');
    }
    const name = location.name.trim();
    const normalizedName = normalizeLocationName(name);
    if (ids.has(location.id) || names.has(normalizedName))
      throw new Error('Location names and IDs must be unique.');
    ids.add(location.id);
    names.add(normalizedName);
    return { id: location.id, name };
  });
  return { locations };
}

export function selectedEventLocationIds(
  definition: unknown
): string[] | undefined {
  if (definition != null && !record(definition)) {
    throw new Error('The audience definition must be an object.');
  }
  if (!record(definition) || !('locationIds' in definition)) return undefined;
  const ids = definition.locationIds;
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 100 ||
    ids.some(id => typeof id !== 'string' || !id.trim()) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error('Select at least one valid event location.');
  }
  return ids as string[];
}

export function snapshotEventLocationNames(
  definition: unknown,
  config: EventLocationConfig | null
): object {
  const ids = selectedEventLocationIds(definition);
  const result = record(definition) ? { ...definition } : {};
  delete result.locationNames;
  if (ids)
    result.locationNames = ids.map(
      id => config!.locations.find(location => location.id === id)!.name
    );
  return result;
}

export function validateEventLocationAudience(
  definition: unknown,
  audienceType: unknown,
  config: EventLocationConfig | null
): string | null {
  try {
    const ids = selectedEventLocationIds(definition);
    if (!ids) return null;
    if (audienceType === 'CHAPTER_MEMBERS')
      return 'Location filters require an event registration audience.';
    if (
      !config ||
      ids.some(id => !config.locations.some(location => location.id === id))
    ) {
      return 'One or more locations are unavailable for this event. Review the location selection.';
    }
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

// Match saved event-location answers, including labels from the submitted
// application snapshot. Current application choices do not limit locations.
export function matchesEventLocations(
  answers: unknown,
  config: EventLocationConfig,
  ids: string[],
  templateSnapshot: unknown
): boolean {
  if (!record(answers)) return false;
  const names = new Set(
    config.locations
      .filter(location => ids.includes(location.id))
      .map(location => normalizeLocationName(location.name))
  );
  const fields = Array.isArray(templateSnapshot)
    ? templateSnapshot.filter(record)
    : [];
  const isLocationField = (value: unknown) =>
    typeof value === 'string' &&
    /(?:^|[^a-z])(location|venue)(?:[^a-z]|$)/i.test(
      value.replace(/([a-z])([A-Z])/g, '$1 $2')
    );
  const locationFieldIds = new Set([
    ...Object.keys(answers).filter(isLocationField),
    ...fields
      .filter(
        field => isLocationField(field.id) || isLocationField(field.label)
      )
      .map(field => field.id)
      .filter((id): id is string => typeof id === 'string'),
  ]);
  return Array.from(locationFieldIds).some(fieldId => {
    const answer = answers[fieldId];
    const values = Array.isArray(answer) ? answer : [answer];
    const field = fields.find(item => item.id === fieldId);
    const options = Array.isArray(field?.options)
      ? field.options.filter(record)
      : [];
    return values.some(value => {
      if (typeof value !== 'string') return false;
      if (names.has(normalizeLocationName(value))) return true;
      const option = options.find(item => item.value === value);
      return (
        typeof option?.label === 'string' &&
        names.has(normalizeLocationName(option.label))
      );
    });
  });
}
