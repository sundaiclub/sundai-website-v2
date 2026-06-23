jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

import {
  ApplicationTemplateValidationError,
  applyProfilePrefillToAnswers,
  composeApplicationFields,
  mapProfileToApplicationPrefill,
  parseTemplateFieldsJson,
  validateApplicationAnswersAgainstSnapshot,
  validateRequiredApplicationAnswers,
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

  it('merges application schema layers in site, chapter, then event order', () => {
    const fields = composeApplicationFields({
      siteFields: [
        siteRequiredFields[1],
        siteRequiredFields[0],
        field('siteOptIn', {
          label: 'Site opt-in',
          type: 'BOOLEAN',
          order: 2,
        }),
      ],
      chapterFields: [
        field('chapterQuestion', {
          label: 'Chapter question',
          order: 1,
        }),
        field('sharedNonSiteQuestion', {
          label: 'Chapter shared question',
          order: 0,
        }),
      ],
      eventFields: [
        field('eventQuestion', {
          label: 'Event question',
          order: 0,
        }),
        field('sharedNonSiteQuestion', {
          label: 'Event shared question',
          type: 'TEXTAREA',
          required: true,
          order: 1,
        }),
      ],
    });

    expect(fields.map(item => item.id)).toEqual([
      'name',
      'email',
      'siteOptIn',
      'chapterQuestion',
      'eventQuestion',
      'sharedNonSiteQuestion',
    ]);
    expect(fields.map(item => item.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(fields.find(item => item.id === 'sharedNonSiteQuestion')).toEqual(
      expect.objectContaining({
        label: 'Event shared question',
        type: 'TEXTAREA',
        required: true,
        order: 5,
      })
    );
  });

  it('validates required answers while accepting valid falsey answers', () => {
    const errors = validateRequiredApplicationAnswers(
      [
        field('name', { label: 'Name', required: true }),
        field('interestAreas', {
          label: 'Interest areas',
          type: 'MULTI_SELECT',
          required: true,
          options: [{ label: 'AI', value: 'ai' }],
        }),
        field('hasBuiltBefore', {
          label: 'Has built before',
          type: 'BOOLEAN',
          required: true,
        }),
        field('teamSize', {
          label: 'Team size',
          type: 'NUMBER',
          required: true,
        }),
      ],
      {
        name: '   ',
        interestAreas: [],
        hasBuiltBefore: false,
        teamSize: 0,
      }
    );

    expect(errors).toEqual([
      {
        fieldId: 'name',
        message: 'Name is required.',
      },
      {
        fieldId: 'interestAreas',
        message: 'Interest areas is required.',
      },
    ]);
  });

  it('prefills profile-backed fields without overwriting existing answers', () => {
    const fields = [
      field('full_name', { label: 'Full name', required: true }),
      field('email', {
        label: 'Email',
        type: 'EMAIL',
        required: true,
      }),
      field('phone-number', {
        label: 'Phone number',
        type: 'PHONE',
      }),
      field('github', {
        label: 'GitHub',
        type: 'URL',
      }),
      field('bio', {
        label: 'Bio',
        type: 'TEXTAREA',
      }),
      field('yearsExperience', {
        label: 'Years of experience',
        type: 'NUMBER',
      }),
    ];
    const profile = {
      name: ' Ada Lovelace ',
      email: 'ada@example.com',
      phoneNumber: ' 555-0100 ',
      githubUrl: 'https://github.com/ada',
      bio: 'First programmer',
    };
    const existingAnswers = {
      email: 'chosen@example.com',
      customQuestion: 'keep me',
    };

    expect(
      mapProfileToApplicationPrefill({
        fields,
        profile,
        existingAnswers,
      })
    ).toEqual({
      full_name: 'Ada Lovelace',
      'phone-number': '555-0100',
      github: 'https://github.com/ada',
      bio: 'First programmer',
    });
    expect(
      applyProfilePrefillToAnswers({
        fields,
        profile,
        existingAnswers,
      })
    ).toEqual({
      full_name: 'Ada Lovelace',
      'phone-number': '555-0100',
      github: 'https://github.com/ada',
      bio: 'First programmer',
      email: 'chosen@example.com',
      customQuestion: 'keep me',
    });
  });

  it('validates submitted answers against the preserved template snapshot', () => {
    const originalSnapshot = composeApplicationFields({
      siteFields: siteRequiredFields,
      chapterFields: [
        field('chapterNeed', {
          label: 'Chapter need',
          required: true,
        }),
      ],
      eventFields: [
        field('launchPlan', {
          label: 'Launch plan',
          type: 'TEXTAREA',
          required: true,
        }),
      ],
    });
    const updatedCurrentFields = composeApplicationFields({
      siteFields: siteRequiredFields,
      chapterFields: [
        field('chapterNeed', {
          label: 'Chapter need',
          required: false,
        }),
      ],
      eventFields: [
        field('newQuestion', {
          label: 'New question',
          required: true,
        }),
      ],
    });

    expect(updatedCurrentFields.map(item => item.id)).toEqual([
      'name',
      'email',
      'chapterNeed',
      'newQuestion',
    ]);
    expect(
      validateApplicationAnswersAgainstSnapshot(originalSnapshot, {
        name: 'Grace Hopper',
        email: 'grace@example.com',
        chapterNeed: '',
        newQuestion: '',
      })
    ).toEqual([
      {
        fieldId: 'chapterNeed',
        message: 'Chapter need is required.',
      },
      {
        fieldId: 'launchPlan',
        message: 'Launch plan is required.',
      },
    ]);
  });
});
