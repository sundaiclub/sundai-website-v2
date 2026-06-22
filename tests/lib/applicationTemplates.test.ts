jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

import {
  ApplicationTemplateValidationError,
  composeApplicationFields,
  parseTemplateFieldsJson,
  validateSiteRequiredFields,
} from '../../src/lib/applicationTemplates';
import type { TemplateFieldDefinition } from '../../src/types/event-management';

const siteRequiredFields: TemplateFieldDefinition[] = [
  {
    id: 'name',
    label: 'Name',
    type: 'TEXT',
    required: true,
    siteRequired: true,
    order: 0,
  },
  {
    id: 'email',
    label: 'Email',
    type: 'EMAIL',
    required: true,
    siteRequired: true,
    order: 1,
  },
];

function field(
  id: string,
  overrides: Partial<TemplateFieldDefinition> = {}
): TemplateFieldDefinition {
  return {
    id,
    label: id,
    type: 'TEXT',
    required: false,
    ...overrides,
  };
}

function expectValidationError(
  action: () => unknown,
  expectedCode: string,
  expectedFieldId?: string
): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ApplicationTemplateValidationError);
    const validationError = error as ApplicationTemplateValidationError;
    expect(validationError.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expectedCode,
          ...(expectedFieldId ? { fieldId: expectedFieldId } : {}),
        }),
      ])
    );
    return;
  }

  throw new Error(`Expected validation error ${expectedCode}`);
}

describe('application template composition', () => {
  it('uses the provided site-admin template as the base fields', () => {
    const composedFields = composeApplicationFields({
      siteFields: siteRequiredFields,
    });

    expect(
      composedFields.map(({ id, required, siteRequired }) => ({
        id,
        required,
        siteRequired,
      }))
    ).toEqual([
      { id: 'name', required: true, siteRequired: true },
      { id: 'email', required: true, siteRequired: true },
    ]);
  });

  it('rejects site templates that remove, weaken, or type-change site-required fields', () => {
    const siteFields = siteRequiredFields;

    expect(validateSiteRequiredFields([siteFields[0]])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SITE_REQUIRED_FIELD_MISSING',
          fieldId: 'email',
        }),
      ])
    );

    expect(
      validateSiteRequiredFields([
        { ...siteFields[0], required: false },
        siteFields[1],
      ])
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SITE_REQUIRED_FIELD_WEAKENED',
          fieldId: 'name',
        }),
      ])
    );

    expect(
      validateSiteRequiredFields([
        siteFields[0],
        { ...siteFields[1], type: 'TEXT' },
      ])
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SITE_REQUIRED_FIELD_TYPE_CHANGED',
          fieldId: 'email',
        }),
      ])
    );

    expectValidationError(
      () => composeApplicationFields({ siteFields: [siteFields[0]] }),
      'SITE_REQUIRED_FIELD_MISSING',
      'email'
    );
  });

  it('rejects chapter attempts to override site-required fields', () => {
    expectValidationError(
      () =>
        composeApplicationFields({
          siteFields: siteRequiredFields,
          chapterFields: [field('email', { label: 'Preferred email' })],
        }),
      'SITE_REQUIRED_FIELD_OVERRIDE',
      'email'
    );
  });

  it('rejects event attempts to override site-required fields', () => {
    expectValidationError(
      () =>
        composeApplicationFields({
          siteFields: siteRequiredFields,
          eventFields: [field('name', { label: 'Display name' })],
        }),
      'SITE_REQUIRED_FIELD_OVERRIDE',
      'name'
    );
  });

  it('allows event fields to override non-site chapter fields', () => {
    const fields = composeApplicationFields({
      siteFields: siteRequiredFields,
      chapterFields: [
        field('dietaryNeeds', {
          label: 'Dietary needs',
          required: true,
          order: 0,
        }),
        field('chapterReferral', {
          label: 'How did you hear about this chapter?',
          order: 1,
        }),
      ],
      eventFields: [
        field('dietaryNeeds', {
          label: 'Dinner restrictions',
          type: 'TEXTAREA',
          required: false,
          order: 0,
        }),
        field('shirtSize', {
          label: 'Shirt size',
          type: 'SELECT',
          required: true,
          options: [
            { label: 'Small', value: 's' },
            { label: 'Medium', value: 'm' },
          ],
          order: 1,
        }),
      ],
    });

    expect(fields.map(item => item.id)).toEqual([
      'name',
      'email',
      'chapterReferral',
      'dietaryNeeds',
      'shirtSize',
    ]);
    expect(fields.find(item => item.id === 'dietaryNeeds')).toEqual(
      expect.objectContaining({
        label: 'Dinner restrictions',
        type: 'TEXTAREA',
        required: false,
        order: 3,
      })
    );
  });

  it('hides chapter defaults while preserving site and event questions', () => {
    const fields = composeApplicationFields({
      siteFields: siteRequiredFields,
      chapterFields: [
        field('chapterDefault', {
          label: 'Chapter default',
          required: true,
        }),
      ],
      eventFields: [
        field('eventSpecific', {
          label: 'Event specific',
          required: true,
        }),
      ],
      hideChapterDefaultQuestions: true,
    });

    expect(fields.map(item => item.id)).toEqual([
      'name',
      'email',
      'eventSpecific',
    ]);
  });

  it('throws parse validation failures for malformed template JSON', () => {
    expectValidationError(
      () => parseTemplateFieldsJson({ fields: [] }),
      'INVALID_FIELDS_JSON'
    );

    expectValidationError(
      () =>
        parseTemplateFieldsJson(
          [
            {
              id: 'track',
              label: 'Track',
              type: 'SELECT',
              required: true,
            },
          ],
          'fieldsJson'
        ),
      'FIELD_OPTIONS_REQUIRED',
      'track'
    );

    expectValidationError(
      () =>
        parseTemplateFieldsJson(
          [
            field('name', { required: true, siteRequired: true }),
            field('email', {
              required: true,
              siteRequired: true,
              type: 'TEXT',
            }),
          ],
          'siteTemplate.fieldsJson',
          { requireSiteRequiredFields: true }
        ),
      'SITE_REQUIRED_FIELD_TYPE_CHANGED',
      'email'
    );
  });
});
