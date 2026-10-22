export type EventCommunicationLocation = {
  id: string;
  name: string;
  answerValues: string[];
};

export type EventLocationConfig = {
  questionId: string;
  locations: EventCommunicationLocation[];
};

export type EventLocationQuestion = {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// Keep old choices: a full venue can be removed from the application while
// its existing applicants still need messages.
export function collectEventLocationQuestions(
  currentFields: unknown,
  registrations: Array<{ templateSnapshotJson: unknown; answersJson: unknown }>
): EventLocationQuestion[] {
  const questions = new Map<string, EventLocationQuestion>();
  for (const fields of [
    currentFields,
    ...registrations.map(row => row.templateSnapshotJson),
  ]) {
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      if (
        !record(field) ||
        typeof field.id !== 'string' ||
        typeof field.label !== 'string' ||
        !['SELECT', 'MULTI_SELECT'].includes(String(field.type))
      )
        continue;
      const question = questions.get(field.id) ?? {
        id: field.id,
        label: field.label,
        options: [],
      };
      for (const option of Array.isArray(field.options) ? field.options : []) {
        if (
          record(option) &&
          typeof option.value === 'string' &&
          typeof option.label === 'string' &&
          !question.options.some(item => item.value === option.value)
        ) {
          question.options.push({ value: option.value, label: option.label });
        }
      }
      questions.set(field.id, question);
    }
  }
  for (const question of Array.from(questions.values())) {
    for (const row of registrations) {
      const answer = record(row.answersJson)
        ? row.answersJson[question.id]
        : undefined;
      for (const value of Array.isArray(answer) ? answer : [answer]) {
        if (
          typeof value === 'string' &&
          value.trim() &&
          !question.options.some(option => option.value === value)
        ) {
          question.options.push({ value, label: value });
        }
      }
    }
  }
  return Array.from(questions.values());
}

export function parseEventLocationConfig(
  value: unknown
): EventLocationConfig | null {
  if (value == null) return null;
  if (
    !record(value) ||
    typeof value.questionId !== 'string' ||
    !value.questionId.trim() ||
    !Array.isArray(value.locations) ||
    value.locations.length > 100
  ) {
    throw new Error('Select an application question for the event locations.');
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  const answerValues = new Set<string>();
  const locations = value.locations.map(location => {
    if (
      !record(location) ||
      typeof location.id !== 'string' ||
      !location.id.trim() ||
      location.id.length > 100 ||
      typeof location.name !== 'string' ||
      !location.name.trim() ||
      location.name.length > 200 ||
      !Array.isArray(location.answerValues) ||
      !location.answerValues.length ||
      location.answerValues.length > 100 ||
      location.answerValues.some(
        answer =>
          typeof answer !== 'string' || !answer.trim() || answer.length > 1000
      )
    ) {
      throw new Error(
        'Each location needs a name and at least one application answer.'
      );
    }
    const name = location.name.trim();
    if (ids.has(location.id) || names.has(name.toLowerCase()))
      throw new Error('Location names and IDs must be unique.');
    ids.add(location.id);
    names.add(name.toLowerCase());
    for (const answer of location.answerValues as string[]) {
      if (answerValues.has(answer))
        throw new Error(
          'An application answer can belong to only one location.'
        );
      answerValues.add(answer);
    }
    return {
      id: location.id,
      name,
      answerValues: location.answerValues as string[],
    };
  });
  return { questionId: value.questionId, locations };
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

export function matchesEventLocations(
  answers: unknown,
  config: EventLocationConfig,
  ids: string[]
): boolean {
  const answer = record(answers) ? answers[config.questionId] : undefined;
  const values = Array.isArray(answer) ? answer : [answer];
  return config.locations.some(
    location =>
      ids.includes(location.id) &&
      values.some(
        value =>
          typeof value === 'string' && location.answerValues.includes(value)
      )
  );
}
