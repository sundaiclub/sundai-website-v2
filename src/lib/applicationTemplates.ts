import type {
  ApplicationControlsState,
  EventApplicationMode,
  JsonObject,
  JsonValue,
  ProfilePrefillSource,
  PublicEventStatus,
  PublicViewerRegistrationState,
  RegistrationFormValidationError,
  RegistrationStatus,
  TemplateFieldDefinition,
  TemplateFieldOption,
  TemplateFieldType,
  TemplateFieldValidation,
} from '@/types/event-management';

const TEMPLATE_FIELD_TYPES: readonly TemplateFieldType[] = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'PHONE',
  'URL',
  'NUMBER',
  'CHECKBOX',
  'SELECT',
  'MULTI_SELECT',
  'DATE',
  'DATETIME',
];

const SITE_REQUIRED_FIELD_CONSTRAINTS: readonly TemplateFieldDefinition[] = [
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

type ApplicationTemplateValidationIssueCode =
  | 'INVALID_FIELDS_JSON'
  | 'FIELD_ID_REQUIRED'
  | 'FIELD_ID_DUPLICATE'
  | 'FIELD_LABEL_REQUIRED'
  | 'FIELD_TYPE_INVALID'
  | 'FIELD_REQUIRED_INVALID'
  | 'FIELD_REUSE_PREVIOUS_ANSWER_INVALID'
  | 'FIELD_SITE_REQUIRED_INVALID'
  | 'FIELD_ORDER_INVALID'
  | 'FIELD_OPTIONS_REQUIRED'
  | 'FIELD_OPTIONS_UNSUPPORTED'
  | 'FIELD_OPTION_INVALID'
  | 'FIELD_OPTION_DUPLICATE'
  | 'FIELD_VALIDATION_INVALID'
  | 'SITE_REQUIRED_FIELD_MISSING'
  | 'SITE_REQUIRED_FIELD_WEAKENED'
  | 'SITE_REQUIRED_FIELD_TYPE_CHANGED'
  | 'SITE_REQUIRED_FIELD_OVERRIDE';

interface ApplicationTemplateValidationIssue {
  code: ApplicationTemplateValidationIssueCode;
  message: string;
  fieldId?: string;
}

export interface ValidateApplicationTemplateFieldsOptions {
  requiredSiteFields?: readonly TemplateFieldDefinition[];
  requireSiteRequiredFields?: boolean;
  allowSiteRequiredFieldIds?: boolean;
  context?: string;
}

export interface ComposeApplicationFieldsInput {
  siteFields: readonly TemplateFieldDefinition[];
  chapterFields?: readonly TemplateFieldDefinition[] | null;
  eventFields?: readonly TemplateFieldDefinition[] | null;
  hideChapterDefaultQuestions?: boolean | null;
}

export interface ApplicationControlStateInput {
  applicationMode: EventApplicationMode;
  applicationsOpen?: boolean | null;
  applicationsClosedAt?: Date | string | null;
  applicationsCloseReason?: string | null;
  capacity?: number | null;
  approvedCount?: number | null;
  autoPromoteWaitlist?: boolean | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  now?: Date;
  viewerSignedIn?: boolean;
  viewerRegistration?: Pick<
    PublicViewerRegistrationState,
    'status' | 'publicSafeMessage'
  > | null;
  waitlistAvailable?: boolean;
  includeCloseReason?: boolean;
}

export interface ApplicationProfilePrefillInput {
  fields: readonly TemplateFieldDefinition[];
  profile?: ProfilePrefillSource | null;
  existingAnswers?: JsonObject | null;
}

interface PublicSafeStatusMessageInput {
  status?: RegistrationStatus | null;
  publicSafeMessage?: string | null;
  applicationControls?: Pick<
    ApplicationControlsState,
    'publicStatus' | 'signInRequired' | 'disabledReason'
  > | null;
}

export class ApplicationTemplateValidationError extends Error {
  readonly issues: ApplicationTemplateValidationIssue[];

  constructor(
    issues: readonly ApplicationTemplateValidationIssue[],
    message = 'Invalid application template fields'
  ) {
    super(message);
    this.name = 'ApplicationTemplateValidationError';
    this.issues = [...issues];
  }
}

function validateApplicationTemplateFields(
  fields: readonly TemplateFieldDefinition[],
  options: ValidateApplicationTemplateFieldsOptions = {}
): ApplicationTemplateValidationIssue[] {
  const issues: ApplicationTemplateValidationIssue[] = [];
  const seenIds = new Set<string>();
  const context = options.context ?? 'fields';

  fields.forEach((field, index) => {
    const fieldId = typeof field.id === 'string' ? field.id.trim() : '';
    const fieldLabel = fieldId || `${index}`;

    if (!fieldId) {
      issues.push({
        code: 'FIELD_ID_REQUIRED',
        message: `${context}[${index}] must include a non-empty id.`,
      });
    } else if (seenIds.has(fieldId)) {
      issues.push({
        code: 'FIELD_ID_DUPLICATE',
        message: `${context} contains duplicate field id "${fieldId}".`,
        fieldId,
      });
    } else {
      seenIds.add(fieldId);
    }

    if (typeof field.label !== 'string' || field.label.trim().length === 0) {
      issues.push({
        code: 'FIELD_LABEL_REQUIRED',
        message: `Field "${fieldLabel}" must include a non-empty label.`,
        fieldId: fieldId || undefined,
      });
    }

    if (!isTemplateFieldType(field.type)) {
      issues.push({
        code: 'FIELD_TYPE_INVALID',
        message: `Field "${fieldLabel}" has an unsupported type.`,
        fieldId: fieldId || undefined,
      });
    }

    if (typeof field.required !== 'boolean') {
      issues.push({
        code: 'FIELD_REQUIRED_INVALID',
        message: `Field "${fieldLabel}" must include a boolean required flag.`,
        fieldId: fieldId || undefined,
      });
    }

    if (
      field.reusePreviousAnswer !== undefined &&
      typeof field.reusePreviousAnswer !== 'boolean'
    ) {
      issues.push({
        code: 'FIELD_REUSE_PREVIOUS_ANSWER_INVALID',
        message: `Field "${fieldLabel}" must use a boolean reusePreviousAnswer flag.`,
        fieldId: fieldId || undefined,
      });
    }

    if (
      field.siteRequired !== undefined &&
      typeof field.siteRequired !== 'boolean'
    ) {
      issues.push({
        code: 'FIELD_SITE_REQUIRED_INVALID',
        message: `Field "${fieldLabel}" must use a boolean siteRequired flag.`,
        fieldId: fieldId || undefined,
      });
    }

    if (field.siteRequired === true && field.required !== true) {
      issues.push({
        code: 'SITE_REQUIRED_FIELD_WEAKENED',
        message: `Site-required field "${fieldLabel}" must remain required.`,
        fieldId: fieldId || undefined,
      });
    }

    if (
      field.order !== undefined &&
      (!Number.isInteger(field.order) || field.order < 0)
    ) {
      issues.push({
        code: 'FIELD_ORDER_INVALID',
        message: `Field "${fieldLabel}" must use a non-negative integer order.`,
        fieldId: fieldId || undefined,
      });
    }

    issues.push(...validateFieldOptions(field));
    issues.push(...validateFieldValidation(field));
  });

  if (options.requireSiteRequiredFields) {
    issues.push(
      ...validateSiteRequiredFields(
        fields,
        options.requiredSiteFields ?? SITE_REQUIRED_FIELD_CONSTRAINTS
      )
    );
  }

  if (options.allowSiteRequiredFieldIds === false) {
    issues.push(
      ...validateNoSiteRequiredFieldOverrides(
        fields,
        options.requiredSiteFields ?? SITE_REQUIRED_FIELD_CONSTRAINTS
      )
    );
  }

  return issues;
}

export function assertValidApplicationTemplateFields(
  fields: readonly TemplateFieldDefinition[],
  options: ValidateApplicationTemplateFieldsOptions = {}
): void {
  const issues = validateApplicationTemplateFields(fields, options);

  if (issues.length > 0) {
    throw new ApplicationTemplateValidationError(issues);
  }
}

export function validateSiteRequiredFields(
  fields: readonly TemplateFieldDefinition[],
  requiredSiteFields: readonly TemplateFieldDefinition[] = SITE_REQUIRED_FIELD_CONSTRAINTS
): ApplicationTemplateValidationIssue[] {
  const issues: ApplicationTemplateValidationIssue[] = [];
  const fieldsById = new Map(fields.map(field => [field.id, field]));

  for (const requiredField of requiredSiteFields) {
    const field = fieldsById.get(requiredField.id);

    if (!field) {
      issues.push({
        code: 'SITE_REQUIRED_FIELD_MISSING',
        message: `Site-required field "${requiredField.id}" cannot be removed.`,
        fieldId: requiredField.id,
      });
      continue;
    }

    if (field.required !== true || field.siteRequired !== true) {
      issues.push({
        code: 'SITE_REQUIRED_FIELD_WEAKENED',
        message: `Site-required field "${requiredField.id}" must remain required and siteRequired.`,
        fieldId: requiredField.id,
      });
    }

    if (field.type !== requiredField.type) {
      issues.push({
        code: 'SITE_REQUIRED_FIELD_TYPE_CHANGED',
        message: `Site-required field "${requiredField.id}" must keep type "${requiredField.type}".`,
        fieldId: requiredField.id,
      });
    }
  }

  return issues;
}

function validateNoSiteRequiredFieldOverrides(
  fields: readonly TemplateFieldDefinition[],
  requiredSiteFields: readonly TemplateFieldDefinition[] = SITE_REQUIRED_FIELD_CONSTRAINTS
): ApplicationTemplateValidationIssue[] {
  const siteRequiredIds = new Set(requiredSiteFields.map(field => field.id));

  return fields
    .filter(field => siteRequiredIds.has(field.id))
    .map(field => ({
      code: 'SITE_REQUIRED_FIELD_OVERRIDE' as const,
      message: `Field "${field.id}" is site-required and cannot be overridden by chapter or event questions.`,
      fieldId: field.id,
    }));
}

export function composeApplicationFields(
  input: ComposeApplicationFieldsInput
): TemplateFieldDefinition[] {
  const siteFields = normalizeTemplateFields(input.siteFields);
  const chapterFields = normalizeTemplateFields(input.chapterFields ?? []);
  const eventFields = normalizeTemplateFields(input.eventFields ?? []);
  const siteRequiredFields = siteFields.filter(field => field.siteRequired);

  assertValidApplicationTemplateFields(siteFields, {
    requireSiteRequiredFields: true,
    context: 'siteFields',
  });
  assertValidApplicationTemplateFields(chapterFields, {
    requiredSiteFields: siteRequiredFields,
    allowSiteRequiredFieldIds: false,
    context: 'chapterFields',
  });
  assertValidApplicationTemplateFields(eventFields, {
    requiredSiteFields: siteRequiredFields,
    allowSiteRequiredFieldIds: false,
    context: 'eventFields',
  });

  const fields = siteFields.map(cloneTemplateField);

  if (input.hideChapterDefaultQuestions !== true) {
    mergeFieldLayer(fields, chapterFields, siteRequiredFields);
  }

  mergeFieldLayer(fields, eventFields, siteRequiredFields);

  return fields.map((field, index) => ({
    ...cloneTemplateField(field),
    order: index,
  }));
}

export function parseTemplateFieldsJson(
  value: unknown,
  context = 'fieldsJson',
  options: ValidateApplicationTemplateFieldsOptions = {}
): TemplateFieldDefinition[] {
  if (!Array.isArray(value)) {
    throw new ApplicationTemplateValidationError(
      [
        {
          code: 'INVALID_FIELDS_JSON',
          message: `${context} must be an array of field definitions.`,
        },
      ],
      `Invalid ${context}`
    );
  }

  const fields = value.map(field => coerceTemplateField(field));
  assertValidApplicationTemplateFields(fields, {
    context,
    ...options,
  });

  return normalizeTemplateFields(fields);
}

export function buildApplicationControlsState(
  input: ApplicationControlStateInput
): ApplicationControlsState {
  const applicationsOpen = input.applicationsOpen === true;
  const publicStatus = getApplicationPublicStatus(input);
  const registrationStatus = input.viewerRegistration?.status ?? null;
  const canEditAnswers = registrationStatus === 'PENDING';
  const canCancelRegistration =
    registrationStatus === 'PENDING' ||
    registrationStatus === 'APPROVED' ||
    registrationStatus === 'WAITLISTED';
  const signInRequired = input.viewerSignedIn !== true && !registrationStatus;
  const disabledReason = getApplicationDisabledReason({
    ...input,
    publicStatus,
    applicationsOpen,
    registrationStatus,
  });

  return {
    applicationMode: input.applicationMode,
    applicationsOpen,
    applicationsClosedAt: input.applicationsClosedAt ?? null,
    applicationsCloseReason:
      input.includeCloseReason === true
        ? normalizePublicSafeMessage(input.applicationsCloseReason)
        : null,
    capacity: input.capacity ?? null,
    approvedCount: input.approvedCount ?? 0,
    autoPromoteWaitlist: input.autoPromoteWaitlist === true,
    publicStatus,
    canSubmit: disabledReason === null,
    canEditAnswers,
    canCancelRegistration,
    signInRequired,
    disabledReason,
    publicMessage: getPublicSafeApplicationStatusMessage({
      status: registrationStatus,
      publicSafeMessage: input.viewerRegistration?.publicSafeMessage ?? null,
      applicationControls: {
        publicStatus,
        signInRequired,
        disabledReason,
      },
    }),
  };
}

export function getApplicationPublicStatus(
  input: Pick<
    ApplicationControlStateInput,
    | 'applicationsOpen'
    | 'capacity'
    | 'approvedCount'
    | 'startTime'
    | 'endTime'
    | 'now'
    | 'waitlistAvailable'
  >
): PublicEventStatus {
  if (hasEventEnded(input)) {
    return 'ENDED';
  }

  if (input.applicationsOpen !== true) {
    return 'CLOSED';
  }

  if (isApplicationCapacityFull(input)) {
    return input.waitlistAvailable === true ? 'WAITLIST_AVAILABLE' : 'FULL';
  }

  return 'OPEN';
}

export function validateApplicationAnswersAgainstSnapshot(
  snapshot: unknown,
  answers: JsonObject | null | undefined
): RegistrationFormValidationError[] {
  const fields = parseTemplateFieldsJson(snapshot, 'templateSnapshotJson');

  return validateRequiredApplicationAnswers(fields, answers);
}

export function validateRequiredApplicationAnswers(
  fields: readonly TemplateFieldDefinition[],
  answers: JsonObject | null | undefined
): RegistrationFormValidationError[] {
  const answerMap = answers ?? {};
  const errors: RegistrationFormValidationError[] = [];

  for (const field of fields) {
    const value = answerMap[field.id];

    if (field.required && isBlankApplicationAnswer(value, field.type)) {
      errors.push({
        fieldId: field.id,
        message: `${field.label} is required.`,
      });
    }
  }

  return errors;
}

export function mapProfileToApplicationPrefill(
  input: ApplicationProfilePrefillInput
): JsonObject {
  const profile = input.profile;
  const existingAnswers = input.existingAnswers ?? {};
  const prefill: JsonObject = {};

  if (!profile) {
    return prefill;
  }

  for (const field of input.fields) {
    if (existingAnswers[field.id] !== undefined) {
      continue;
    }

    const value = getProfilePrefillValue(field, profile);

    if (value !== null) {
      prefill[field.id] = value;
    }
  }

  return prefill;
}

export function applyProfilePrefillToAnswers(
  input: ApplicationProfilePrefillInput
): JsonObject {
  return {
    ...mapProfileToApplicationPrefill(input),
    ...(input.existingAnswers ?? {}),
  };
}

function getPublicSafeApplicationStatusMessage(
  input: PublicSafeStatusMessageInput
): string | null {
  const configuredMessage = normalizePublicSafeMessage(input.publicSafeMessage);

  if (input.status === 'BLOCKED') {
    return 'You are unable to register for this event at this time.';
  }

  if (configuredMessage) {
    return configuredMessage;
  }

  switch (input.status) {
    case 'PENDING':
      return 'Your application is pending review.';
    case 'APPROVED':
      return 'You are approved for this event.';
    case 'WAITLISTED':
      return 'You are on the waitlist for this event.';
    case 'DECLINED':
      return 'We cannot accommodate your application for this event.';
    case 'CANCELLED':
      return 'Your registration has been cancelled.';
    default:
      break;
  }

  if (input.applicationControls?.signInRequired) {
    return 'Sign in to register for this event.';
  }

  if (input.applicationControls?.disabledReason) {
    return input.applicationControls.disabledReason;
  }

  return null;
}

function mergeFieldLayer(
  fields: TemplateFieldDefinition[],
  layer: readonly TemplateFieldDefinition[],
  siteRequiredFields: readonly TemplateFieldDefinition[]
): void {
  const siteRequiredIds = new Set(siteRequiredFields.map(field => field.id));

  for (const field of layer) {
    if (siteRequiredIds.has(field.id)) {
      throw new ApplicationTemplateValidationError(
        [
          {
            code: 'SITE_REQUIRED_FIELD_OVERRIDE',
            message: `Field "${field.id}" is site-required and cannot be overridden.`,
            fieldId: field.id,
          },
        ],
        'Site-required application fields cannot be overridden'
      );
    }

    const existingIndex = fields.findIndex(
      existingField => existingField.id === field.id
    );

    if (existingIndex >= 0) {
      fields.splice(existingIndex, 1);
    }

    fields.push(cloneTemplateField(field));
  }
}

function normalizeTemplateFields(
  fields: readonly TemplateFieldDefinition[]
): TemplateFieldDefinition[] {
  return fields.map(cloneTemplateField).sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return 0;
  });
}

function cloneTemplateField(
  field: TemplateFieldDefinition
): TemplateFieldDefinition {
  return {
    ...field,
    options: field.options?.map(option => ({ ...option })),
    validation: field.validation ? { ...field.validation } : undefined,
  };
}

function getApplicationDisabledReason(
  input: ApplicationControlStateInput & {
    publicStatus: PublicEventStatus;
    applicationsOpen: boolean;
    registrationStatus: RegistrationStatus | null;
  }
): string | null {
  if (input.registrationStatus) {
    return 'You already have a registration for this event.';
  }

  if (input.viewerSignedIn !== true) {
    return 'Sign in to register for this event.';
  }

  if (input.publicStatus === 'ENDED') {
    return 'This event has ended.';
  }

  if (!input.applicationsOpen || input.publicStatus === 'CLOSED') {
    return 'Applications are closed for this event.';
  }

  if (input.publicStatus === 'FULL') {
    return 'This event is full.';
  }

  return null;
}

function isApplicationCapacityFull(
  input: Pick<ApplicationControlStateInput, 'capacity' | 'approvedCount'>
): boolean {
  return (
    typeof input.capacity === 'number' &&
    Number.isFinite(input.capacity) &&
    input.capacity > 0 &&
    (input.approvedCount ?? 0) >= input.capacity
  );
}

function hasEventEnded(
  input: Pick<ApplicationControlStateInput, 'startTime' | 'endTime' | 'now'>
): boolean {
  const now = input.now ?? new Date();
  const endTime = coerceDate(input.endTime);
  const startTime = coerceDate(input.startTime);
  const cutoff = endTime ?? startTime;

  return cutoff !== null && cutoff.getTime() <= now.getTime();
}

function coerceDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isBlankApplicationAnswer(
  value: JsonValue | undefined,
  fieldType: TemplateFieldType
): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (fieldType === 'CHECKBOX') {
    return typeof value !== 'boolean';
  }

  return false;
}

function getProfilePrefillValue(
  field: TemplateFieldDefinition,
  profile: ProfilePrefillSource
): JsonValue | null {
  const profileValue = getProfileFieldValue(field.id, profile);

  if (profileValue === null) {
    return null;
  }

  if (!canPrefillFieldType(field.type)) {
    return null;
  }

  return profileValue;
}

function getProfileFieldValue(
  fieldId: string,
  profile: ProfilePrefillSource
): string | null {
  const normalizedFieldId = normalizeFieldId(fieldId);
  const profileValues: Record<string, string | null | undefined> = {
    name: profile.name,
    fullname: profile.name,
    email: profile.email,
    phonenumber: profile.phoneNumber,
    phone: profile.phoneNumber,
    username: profile.username,
    handle: profile.username,
    bio: profile.bio,
    githuburl: profile.githubUrl,
    github: profile.githubUrl,
    linkedinurl: profile.linkedinUrl,
    linkedin: profile.linkedinUrl,
    twitterurl: profile.twitterUrl,
    twitter: profile.twitterUrl,
    websiteurl: profile.websiteUrl,
    website: profile.websiteUrl,
    discordname: profile.discordName,
    discord: profile.discordName,
  };
  const value = profileValues[normalizedFieldId];

  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeFieldId(fieldId: string): string {
  return fieldId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function canPrefillFieldType(fieldType: TemplateFieldType): boolean {
  return (
    fieldType === 'TEXT' ||
    fieldType === 'TEXTAREA' ||
    fieldType === 'EMAIL' ||
    fieldType === 'PHONE' ||
    fieldType === 'URL'
  );
}

function normalizePublicSafeMessage(
  message: string | null | undefined
): string | null {
  if (typeof message !== 'string') {
    return null;
  }

  const trimmedMessage = message.trim();

  return trimmedMessage.length > 0 ? trimmedMessage : null;
}

function coerceTemplateField(value: unknown): TemplateFieldDefinition {
  if (!isRecord(value)) {
    return {
      id: '',
      label: '',
      type: '' as TemplateFieldType,
      required: undefined as unknown as boolean,
    };
  }

  return {
    id: typeof value.id === 'string' ? value.id : '',
    label: typeof value.label === 'string' ? value.label : '',
    type:
      typeof value.type === 'string'
        ? (value.type as TemplateFieldType)
        : ('' as TemplateFieldType),
    required: value.required as boolean,
    reusePreviousAnswer:
      value.reusePreviousAnswer === undefined
        ? undefined
        : (value.reusePreviousAnswer as boolean),
    siteRequired:
      value.siteRequired === undefined
        ? undefined
        : (value.siteRequired as boolean),
    helpText: typeof value.helpText === 'string' ? value.helpText : null,
    placeholder:
      typeof value.placeholder === 'string' ? value.placeholder : null,
    options: Array.isArray(value.options)
      ? value.options.map(coerceTemplateFieldOption)
      : undefined,
    validation: isRecord(value.validation)
      ? coerceTemplateFieldValidation(value.validation)
      : undefined,
    order:
      typeof value.order === 'number' && Number.isFinite(value.order)
        ? value.order
        : undefined,
  };
}

function coerceTemplateFieldOption(value: unknown): TemplateFieldOption {
  if (!isRecord(value)) {
    return { label: '', value: '' };
  }

  return {
    label: typeof value.label === 'string' ? value.label : '',
    value: typeof value.value === 'string' ? value.value : '',
  };
}

function coerceTemplateFieldValidation(
  value: Record<string, unknown>
): TemplateFieldValidation {
  return {
    minLength:
      value.minLength === undefined
        ? undefined
        : typeof value.minLength === 'number'
          ? value.minLength
          : (value.minLength as number),
    maxLength:
      value.maxLength === undefined
        ? undefined
        : typeof value.maxLength === 'number'
          ? value.maxLength
          : (value.maxLength as number),
    min:
      value.min === undefined
        ? undefined
        : typeof value.min === 'number'
          ? value.min
          : (value.min as number),
    max:
      value.max === undefined
        ? undefined
        : typeof value.max === 'number'
          ? value.max
          : (value.max as number),
    pattern:
      value.pattern === undefined
        ? undefined
        : typeof value.pattern === 'string'
          ? value.pattern
          : (value.pattern as string),
  };
}

function validateFieldOptions(
  field: TemplateFieldDefinition
): ApplicationTemplateValidationIssue[] {
  const issues: ApplicationTemplateValidationIssue[] = [];
  const expectsOptions =
    field.type === 'SELECT' || field.type === 'MULTI_SELECT';

  if (!expectsOptions && field.options && field.options.length > 0) {
    issues.push({
      code: 'FIELD_OPTIONS_UNSUPPORTED',
      message: `Field "${field.id}" cannot include options for type "${field.type}".`,
      fieldId: field.id,
    });
  }

  if (expectsOptions && (!field.options || field.options.length === 0)) {
    issues.push({
      code: 'FIELD_OPTIONS_REQUIRED',
      message: `Field "${field.id}" must include at least one option.`,
      fieldId: field.id,
    });
    return issues;
  }

  const seenValues = new Set<string>();

  field.options?.forEach((option, index) => {
    if (
      typeof option.label !== 'string' ||
      option.label.trim().length === 0 ||
      typeof option.value !== 'string' ||
      option.value.trim().length === 0
    ) {
      issues.push({
        code: 'FIELD_OPTION_INVALID',
        message: `Field "${field.id}" option ${index} must include non-empty label and value.`,
        fieldId: field.id,
      });
      return;
    }

    if (seenValues.has(option.value)) {
      issues.push({
        code: 'FIELD_OPTION_DUPLICATE',
        message: `Field "${field.id}" contains duplicate option value "${option.value}".`,
        fieldId: field.id,
      });
      return;
    }

    seenValues.add(option.value);
  });

  return issues;
}

function validateFieldValidation(
  field: TemplateFieldDefinition
): ApplicationTemplateValidationIssue[] {
  const issues: ApplicationTemplateValidationIssue[] = [];
  const validation = field.validation;

  if (!validation) {
    return issues;
  }

  if (
    validation.minLength !== undefined &&
    (!Number.isInteger(validation.minLength) || validation.minLength < 0)
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" minLength must be a non-negative integer.`,
      fieldId: field.id,
    });
  }

  if (
    validation.maxLength !== undefined &&
    (!Number.isInteger(validation.maxLength) || validation.maxLength < 0)
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" maxLength must be a non-negative integer.`,
      fieldId: field.id,
    });
  }

  if (
    validation.minLength !== undefined &&
    validation.maxLength !== undefined &&
    validation.minLength > validation.maxLength
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" minLength cannot exceed maxLength.`,
      fieldId: field.id,
    });
  }

  if (
    validation.min !== undefined &&
    (typeof validation.min !== 'number' || !Number.isFinite(validation.min))
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" min must be a finite number.`,
      fieldId: field.id,
    });
  }

  if (
    validation.max !== undefined &&
    (typeof validation.max !== 'number' || !Number.isFinite(validation.max))
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" max must be a finite number.`,
      fieldId: field.id,
    });
  }

  if (
    validation.min !== undefined &&
    validation.max !== undefined &&
    validation.min > validation.max
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" min cannot exceed max.`,
      fieldId: field.id,
    });
  }

  if (validation.pattern !== undefined) {
    if (typeof validation.pattern !== 'string') {
      issues.push({
        code: 'FIELD_VALIDATION_INVALID',
        message: `Field "${field.id}" pattern must be a string.`,
        fieldId: field.id,
      });
      return issues;
    }

    try {
      new RegExp(validation.pattern);
    } catch {
      issues.push({
        code: 'FIELD_VALIDATION_INVALID',
        message: `Field "${field.id}" pattern must be a valid regular expression.`,
        fieldId: field.id,
      });
    }
  }

  return issues;
}

function isTemplateFieldType(value: unknown): value is TemplateFieldType {
  return (
    typeof value === 'string' &&
    TEMPLATE_FIELD_TYPES.includes(value as TemplateFieldType)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
