import prisma from '@/lib/prisma'
import type {
  ApplicationTemplateScope,
  EntityId,
  MergedApplicationTemplate,
  TemplateFieldDefinition,
  TemplateFieldOption,
  TemplateFieldType,
  TemplateFieldValidation,
} from '@/types/event-management'

const TEMPLATE_FIELD_TYPES: readonly TemplateFieldType[] = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'PHONE',
  'URL',
  'NUMBER',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
  'DATE',
  'DATETIME',
]

const DEFAULT_SITE_APPLICATION_FIELDS: readonly TemplateFieldDefinition[] = [
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
]

type ApplicationTemplateValidationIssueCode =
  | 'INVALID_FIELDS_JSON'
  | 'FIELD_ID_REQUIRED'
  | 'FIELD_ID_DUPLICATE'
  | 'FIELD_LABEL_REQUIRED'
  | 'FIELD_TYPE_INVALID'
  | 'FIELD_REQUIRED_INVALID'
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
  | 'SITE_REQUIRED_FIELD_OVERRIDE'

interface ApplicationTemplateValidationIssue {
  code: ApplicationTemplateValidationIssueCode
  message: string
  fieldId?: string
}

export interface ValidateApplicationTemplateFieldsOptions {
  requiredSiteFields?: readonly TemplateFieldDefinition[]
  requireSiteRequiredFields?: boolean
  allowSiteRequiredFieldIds?: boolean
  context?: string
}

export interface ComposeApplicationFieldsInput {
  siteFields?: readonly TemplateFieldDefinition[] | null
  chapterFields?: readonly TemplateFieldDefinition[] | null
  eventFields?: readonly TemplateFieldDefinition[] | null
  hideChapterDefaultQuestions?: boolean | null
}

interface ApplicationTemplatePrismaRecord {
  id: EntityId
  scope?: ApplicationTemplateScope | string
  chapterId?: EntityId | null
  fieldsJson: unknown
  isActive?: boolean | null
}

interface EventApplicationQuestionPrismaRecord {
  id: EntityId
  chapterId?: EntityId | null
  applicationQuestionsJson?: unknown
  hideChapterDefaultQuestions?: boolean | null
}

interface ApplicationTemplatePrismaClient {
  applicationTemplate: {
    findFirst(args: unknown): Promise<ApplicationTemplatePrismaRecord | null>
  }
  event: {
    findUnique(args: unknown): Promise<EventApplicationQuestionPrismaRecord | null>
  }
}

interface FetchApplicationTemplateInput {
  scope: ApplicationTemplateScope
  chapterId?: EntityId | null
  prisma?: ApplicationTemplatePrismaClient
}

interface FetchMergedApplicationTemplateInput {
  chapterId?: EntityId | null
  eventId?: EntityId | null
  prisma?: ApplicationTemplatePrismaClient
}

export class ApplicationTemplateValidationError extends Error {
  readonly issues: ApplicationTemplateValidationIssue[]

  constructor(
    issues: readonly ApplicationTemplateValidationIssue[],
    message = 'Invalid application template fields'
  ) {
    super(message)
    this.name = 'ApplicationTemplateValidationError'
    this.issues = [...issues]
  }
}

export function getDefaultSiteApplicationFields(): TemplateFieldDefinition[] {
  return DEFAULT_SITE_APPLICATION_FIELDS.map(cloneTemplateField)
}

function validateApplicationTemplateFields(
  fields: readonly TemplateFieldDefinition[],
  options: ValidateApplicationTemplateFieldsOptions = {}
): ApplicationTemplateValidationIssue[] {
  const issues: ApplicationTemplateValidationIssue[] = []
  const seenIds = new Set<string>()
  const context = options.context ?? 'fields'

  fields.forEach((field, index) => {
    const fieldId = typeof field.id === 'string' ? field.id.trim() : ''
    const fieldLabel = fieldId || `${index}`

    if (!fieldId) {
      issues.push({
        code: 'FIELD_ID_REQUIRED',
        message: `${context}[${index}] must include a non-empty id.`,
      })
    } else if (seenIds.has(fieldId)) {
      issues.push({
        code: 'FIELD_ID_DUPLICATE',
        message: `${context} contains duplicate field id "${fieldId}".`,
        fieldId,
      })
    } else {
      seenIds.add(fieldId)
    }

    if (typeof field.label !== 'string' || field.label.trim().length === 0) {
      issues.push({
        code: 'FIELD_LABEL_REQUIRED',
        message: `Field "${fieldLabel}" must include a non-empty label.`,
        fieldId: fieldId || undefined,
      })
    }

    if (!isTemplateFieldType(field.type)) {
      issues.push({
        code: 'FIELD_TYPE_INVALID',
        message: `Field "${fieldLabel}" has an unsupported type.`,
        fieldId: fieldId || undefined,
      })
    }

    if (typeof field.required !== 'boolean') {
      issues.push({
        code: 'FIELD_REQUIRED_INVALID',
        message: `Field "${fieldLabel}" must include a boolean required flag.`,
        fieldId: fieldId || undefined,
      })
    }

    if (
      field.siteRequired !== undefined &&
      typeof field.siteRequired !== 'boolean'
    ) {
      issues.push({
        code: 'FIELD_SITE_REQUIRED_INVALID',
        message: `Field "${fieldLabel}" must use a boolean siteRequired flag.`,
        fieldId: fieldId || undefined,
      })
    }

    if (field.siteRequired === true && field.required !== true) {
      issues.push({
        code: 'SITE_REQUIRED_FIELD_WEAKENED',
        message: `Site-required field "${fieldLabel}" must remain required.`,
        fieldId: fieldId || undefined,
      })
    }

    if (
      field.order !== undefined &&
      (!Number.isInteger(field.order) || field.order < 0)
    ) {
      issues.push({
        code: 'FIELD_ORDER_INVALID',
        message: `Field "${fieldLabel}" must use a non-negative integer order.`,
        fieldId: fieldId || undefined,
      })
    }

    issues.push(...validateFieldOptions(field))
    issues.push(...validateFieldValidation(field))
  })

  if (options.requireSiteRequiredFields) {
    issues.push(
      ...validateSiteRequiredFields(
        fields,
        options.requiredSiteFields ?? DEFAULT_SITE_APPLICATION_FIELDS
      )
    )
  }

  if (options.allowSiteRequiredFieldIds === false) {
    issues.push(
      ...validateNoSiteRequiredFieldOverrides(
        fields,
        options.requiredSiteFields ?? DEFAULT_SITE_APPLICATION_FIELDS
      )
    )
  }

  return issues
}

export function assertValidApplicationTemplateFields(
  fields: readonly TemplateFieldDefinition[],
  options: ValidateApplicationTemplateFieldsOptions = {}
): void {
  const issues = validateApplicationTemplateFields(fields, options)

  if (issues.length > 0) {
    throw new ApplicationTemplateValidationError(issues)
  }
}

export function validateSiteRequiredFields(
  fields: readonly TemplateFieldDefinition[],
  requiredSiteFields: readonly TemplateFieldDefinition[] = DEFAULT_SITE_APPLICATION_FIELDS
): ApplicationTemplateValidationIssue[] {
  const issues: ApplicationTemplateValidationIssue[] = []
  const fieldsById = new Map(fields.map((field) => [field.id, field]))

  for (const requiredField of requiredSiteFields) {
    const field = fieldsById.get(requiredField.id)

    if (!field) {
      issues.push({
        code: 'SITE_REQUIRED_FIELD_MISSING',
        message: `Site-required field "${requiredField.id}" cannot be removed.`,
        fieldId: requiredField.id,
      })
      continue
    }

    if (field.required !== true || field.siteRequired !== true) {
      issues.push({
        code: 'SITE_REQUIRED_FIELD_WEAKENED',
        message: `Site-required field "${requiredField.id}" must remain required and siteRequired.`,
        fieldId: requiredField.id,
      })
    }

    if (field.type !== requiredField.type) {
      issues.push({
        code: 'SITE_REQUIRED_FIELD_TYPE_CHANGED',
        message: `Site-required field "${requiredField.id}" must keep type "${requiredField.type}".`,
        fieldId: requiredField.id,
      })
    }
  }

  return issues
}

function validateNoSiteRequiredFieldOverrides(
  fields: readonly TemplateFieldDefinition[],
  requiredSiteFields: readonly TemplateFieldDefinition[] = DEFAULT_SITE_APPLICATION_FIELDS
): ApplicationTemplateValidationIssue[] {
  const siteRequiredIds = new Set(requiredSiteFields.map((field) => field.id))

  return fields
    .filter((field) => siteRequiredIds.has(field.id))
    .map((field) => ({
      code: 'SITE_REQUIRED_FIELD_OVERRIDE' as const,
      message: `Field "${field.id}" is site-required and cannot be overridden by chapter or event questions.`,
      fieldId: field.id,
    }))
}

export function composeApplicationFields(
  input: ComposeApplicationFieldsInput
): TemplateFieldDefinition[] {
  const siteFields = normalizeTemplateFields(
    input.siteFields ?? DEFAULT_SITE_APPLICATION_FIELDS
  )
  const chapterFields = normalizeTemplateFields(input.chapterFields ?? [])
  const eventFields = normalizeTemplateFields(input.eventFields ?? [])
  const siteRequiredFields = siteFields.filter((field) => field.siteRequired)

  assertValidApplicationTemplateFields(siteFields, {
    requireSiteRequiredFields: true,
    context: 'siteFields',
  })
  assertValidApplicationTemplateFields(chapterFields, {
    requiredSiteFields: siteRequiredFields,
    allowSiteRequiredFieldIds: false,
    context: 'chapterFields',
  })
  assertValidApplicationTemplateFields(eventFields, {
    requiredSiteFields: siteRequiredFields,
    allowSiteRequiredFieldIds: false,
    context: 'eventFields',
  })

  const fields = siteFields.map(cloneTemplateField)

  if (input.hideChapterDefaultQuestions !== true) {
    mergeFieldLayer(fields, chapterFields, siteRequiredFields)
  }

  mergeFieldLayer(fields, eventFields, siteRequiredFields)

  return fields.map((field, index) => ({
    ...cloneTemplateField(field),
    order: index,
  }))
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
    )
  }

  const fields = value.map((field) => coerceTemplateField(field))
  assertValidApplicationTemplateFields(fields, {
    context,
    ...options,
  })

  return normalizeTemplateFields(fields)
}

async function fetchActiveApplicationTemplate(
  input: FetchApplicationTemplateInput
): Promise<ApplicationTemplatePrismaRecord | null> {
  const client = input.prisma ?? getApplicationTemplatePrismaClient()
  const where =
    input.scope === 'SITE'
      ? { scope: 'SITE', isActive: true }
      : {
          scope: 'CHAPTER',
          chapterId: input.chapterId,
          isActive: true,
        }

  return client.applicationTemplate.findFirst({
    where,
    orderBy: { updatedAt: 'desc' },
  })
}

function fetchActiveSiteApplicationTemplate(
  client?: ApplicationTemplatePrismaClient
): Promise<ApplicationTemplatePrismaRecord | null> {
  return fetchActiveApplicationTemplate({
    scope: 'SITE',
    prisma: client,
  })
}

function fetchActiveChapterApplicationTemplate(
  chapterId: EntityId,
  client?: ApplicationTemplatePrismaClient
): Promise<ApplicationTemplatePrismaRecord | null> {
  return fetchActiveApplicationTemplate({
    scope: 'CHAPTER',
    chapterId,
    prisma: client,
  })
}

async function fetchEventApplicationQuestionConfig(
  eventId: EntityId,
  client?: ApplicationTemplatePrismaClient
): Promise<EventApplicationQuestionPrismaRecord | null> {
  const prismaClient = client ?? getApplicationTemplatePrismaClient()

  return prismaClient.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      chapterId: true,
      applicationQuestionsJson: true,
      hideChapterDefaultQuestions: true,
    },
  })
}

export async function fetchMergedApplicationTemplate(
  input: FetchMergedApplicationTemplateInput = {}
): Promise<MergedApplicationTemplate> {
  const client = input.prisma ?? getApplicationTemplatePrismaClient()
  const eventConfig = input.eventId
    ? await fetchEventApplicationQuestionConfig(input.eventId, client)
    : null
  const chapterId = input.chapterId ?? eventConfig?.chapterId ?? null
  const siteTemplate = await fetchActiveSiteApplicationTemplate(client)

  if (!siteTemplate) {
    throw new ApplicationTemplateValidationError(
      [
        {
          code: 'SITE_REQUIRED_FIELD_MISSING',
          message: 'An active site application template is required.',
        },
      ],
      'Active site application template not found'
    )
  }

  const chapterTemplate = chapterId
    ? await fetchActiveChapterApplicationTemplate(chapterId, client)
    : null
  const siteFields = parseTemplateFieldsJson(
    siteTemplate.fieldsJson,
    'siteTemplate.fieldsJson',
    { requireSiteRequiredFields: true }
  )
  const siteRequiredFields = siteFields.filter((field) => field.siteRequired)
  const chapterFields = chapterTemplate
    ? parseTemplateFieldsJson(
        chapterTemplate.fieldsJson,
        'chapterTemplate.fieldsJson',
        {
          requiredSiteFields: siteRequiredFields,
          allowSiteRequiredFieldIds: false,
        }
      )
    : []
  const eventFields = eventConfig?.applicationQuestionsJson
    ? parseTemplateFieldsJson(
        eventConfig.applicationQuestionsJson,
        'event.applicationQuestionsJson',
        {
          requiredSiteFields: siteRequiredFields,
          allowSiteRequiredFieldIds: false,
        }
      )
    : []

  return {
    siteTemplateId: siteTemplate.id,
    chapterTemplateId: chapterTemplate?.id ?? null,
    eventId: eventConfig?.id ?? input.eventId ?? null,
    fields: composeApplicationFields({
      siteFields,
      chapterFields,
      eventFields,
      hideChapterDefaultQuestions: eventConfig?.hideChapterDefaultQuestions,
    }),
  }
}

function getApplicationTemplatePrismaClient(): ApplicationTemplatePrismaClient {
  return prisma as unknown as ApplicationTemplatePrismaClient
}

function mergeFieldLayer(
  fields: TemplateFieldDefinition[],
  layer: readonly TemplateFieldDefinition[],
  siteRequiredFields: readonly TemplateFieldDefinition[]
): void {
  const siteRequiredIds = new Set(siteRequiredFields.map((field) => field.id))

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
      )
    }

    const existingIndex = fields.findIndex(
      (existingField) => existingField.id === field.id
    )

    if (existingIndex >= 0) {
      fields.splice(existingIndex, 1)
    }

    fields.push(cloneTemplateField(field))
  }
}

function normalizeTemplateFields(
  fields: readonly TemplateFieldDefinition[]
): TemplateFieldDefinition[] {
  return fields
    .map(cloneTemplateField)
    .sort((left, right) => {
      const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
      const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }

      return 0
    })
}

function cloneTemplateField(
  field: TemplateFieldDefinition
): TemplateFieldDefinition {
  return {
    ...field,
    options: field.options?.map((option) => ({ ...option })),
    validation: field.validation ? { ...field.validation } : undefined,
  }
}

function coerceTemplateField(value: unknown): TemplateFieldDefinition {
  if (!isRecord(value)) {
    return {
      id: '',
      label: '',
      type: '' as TemplateFieldType,
      required: undefined as unknown as boolean,
    }
  }

  return {
    id: typeof value.id === 'string' ? value.id : '',
    label: typeof value.label === 'string' ? value.label : '',
    type:
      typeof value.type === 'string'
        ? (value.type as TemplateFieldType)
        : ('' as TemplateFieldType),
    required: value.required as boolean,
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
  }
}

function coerceTemplateFieldOption(value: unknown): TemplateFieldOption {
  if (!isRecord(value)) {
    return { label: '', value: '' }
  }

  return {
    label: typeof value.label === 'string' ? value.label : '',
    value: typeof value.value === 'string' ? value.value : '',
  }
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
  }
}

function validateFieldOptions(
  field: TemplateFieldDefinition
): ApplicationTemplateValidationIssue[] {
  const issues: ApplicationTemplateValidationIssue[] = []
  const expectsOptions = field.type === 'SELECT' || field.type === 'MULTI_SELECT'

  if (!expectsOptions && field.options && field.options.length > 0) {
    issues.push({
      code: 'FIELD_OPTIONS_UNSUPPORTED',
      message: `Field "${field.id}" cannot include options for type "${field.type}".`,
      fieldId: field.id,
    })
  }

  if (expectsOptions && (!field.options || field.options.length === 0)) {
    issues.push({
      code: 'FIELD_OPTIONS_REQUIRED',
      message: `Field "${field.id}" must include at least one option.`,
      fieldId: field.id,
    })
    return issues
  }

  const seenValues = new Set<string>()

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
      })
      return
    }

    if (seenValues.has(option.value)) {
      issues.push({
        code: 'FIELD_OPTION_DUPLICATE',
        message: `Field "${field.id}" contains duplicate option value "${option.value}".`,
        fieldId: field.id,
      })
      return
    }

    seenValues.add(option.value)
  })

  return issues
}

function validateFieldValidation(
  field: TemplateFieldDefinition
): ApplicationTemplateValidationIssue[] {
  const issues: ApplicationTemplateValidationIssue[] = []
  const validation = field.validation

  if (!validation) {
    return issues
  }

  if (
    validation.minLength !== undefined &&
    (!Number.isInteger(validation.minLength) || validation.minLength < 0)
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" minLength must be a non-negative integer.`,
      fieldId: field.id,
    })
  }

  if (
    validation.maxLength !== undefined &&
    (!Number.isInteger(validation.maxLength) || validation.maxLength < 0)
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" maxLength must be a non-negative integer.`,
      fieldId: field.id,
    })
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
    })
  }

  if (
    validation.min !== undefined &&
    (typeof validation.min !== 'number' || !Number.isFinite(validation.min))
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" min must be a finite number.`,
      fieldId: field.id,
    })
  }

  if (
    validation.max !== undefined &&
    (typeof validation.max !== 'number' || !Number.isFinite(validation.max))
  ) {
    issues.push({
      code: 'FIELD_VALIDATION_INVALID',
      message: `Field "${field.id}" max must be a finite number.`,
      fieldId: field.id,
    })
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
    })
  }

  if (validation.pattern !== undefined) {
    if (typeof validation.pattern !== 'string') {
      issues.push({
        code: 'FIELD_VALIDATION_INVALID',
        message: `Field "${field.id}" pattern must be a string.`,
        fieldId: field.id,
      })
      return issues
    }

    try {
      new RegExp(validation.pattern)
    } catch {
      issues.push({
        code: 'FIELD_VALIDATION_INVALID',
        message: `Field "${field.id}" pattern must be a valid regular expression.`,
        fieldId: field.id,
      })
    }
  }

  return issues
}

function isTemplateFieldType(value: unknown): value is TemplateFieldType {
  return (
    typeof value === 'string' &&
    TEMPLATE_FIELD_TYPES.includes(value as TemplateFieldType)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
