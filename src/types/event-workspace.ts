import type {
  EntityId,
  EventApplicationMode,
  EventStaffRole,
  EventStatus,
  JsonObject,
  RegistrationStatus,
} from './event-management';

export type WorkspaceSection =
  | 'overview'
  | 'registrations'
  | 'communications'
  | 'materials'
  | 'projects'
  | 'pitch'
  | 'notes'
  | 'reporting';

export type WorkspaceUnavailableMetric = 'checkIn' | 'attendance' | 'noShows';

export interface EventWorkspaceCapabilities {
  administerEvent: boolean;
  assignStaff: boolean;
  decideApplicants: boolean;
  manageOperations: boolean;
  sendCommunications: boolean;
  manageMaterials: boolean;
  managePitch: boolean;
  editNotes: boolean;
  viewNoteHistory: boolean;
}

export interface EventWorkspaceChapter {
  id: EntityId;
  name: string;
  slug: string;
  timezone: string;
}

export interface EventWorkspaceEvent {
  id: EntityId;
  title: string;
  status: EventStatus;
  chapter: EventWorkspaceChapter;
  startTime: string;
  endTime: string;
  capacity: number | null;
  applicationMode: EventApplicationMode;
  applicationsOpen: boolean;
  autoPromoteWaitlist: boolean;
  publicUrl: string;
  hasApprovedOnlyDetails: boolean;
}

export interface EventWorkspaceStaffMember {
  id: EntityId;
  hackerId: EntityId;
  name: string;
  role: EventStaffRole;
}

export type WorkspaceRegistrationCounts = Record<
  Lowercase<Exclude<RegistrationStatus, 'BLOCKED'>>,
  number
>;

export interface WorkspaceProjectCounts {
  total: number;
  submittedCards: number;
}

export interface WorkspacePitchCounts {
  queued: number;
  pitched: number;
  highlighted: number;
}

export interface EventWorkspaceCounts {
  registrations: WorkspaceRegistrationCounts;
  projects: WorkspaceProjectCounts;
  pitch: WorkspacePitchCounts;
  materials: number;
  communications: number;
}

export interface EventWorkspaceOverview {
  event: EventWorkspaceEvent;
  capabilities: EventWorkspaceCapabilities;
  staff: EventWorkspaceStaffMember[];
  counts: EventWorkspaceCounts;
  availableSections: WorkspaceSection[];
  unavailable: WorkspaceUnavailableMetric[];
  publicationNotification: EventPublicationNotificationSummary | null;
}

export interface EventPublicationNotificationSummary {
  status: EventCommunicationStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  emailRecipientCount: number;
  smsRecipientCount: number;
  sentAt: string | null;
}

export type EventMaterialKind = 'LINK' | 'FILE';
export type EventMaterialVisibility =
  | 'PUBLIC'
  | 'APPROVED_ATTENDEES'
  | 'ORGANIZERS_ONLY';
export type EventMaterialAuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'REORDERED'
  | 'REMOVED';

export interface EventMaterial {
  id: EntityId;
  eventId: EntityId;
  kind: EventMaterialKind;
  visibility: EventMaterialVisibility;
  title: string;
  description: string | null;
  externalUrl: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  size: number | null;
  position: number;
  isAvailable: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
  createdById: EntityId;
  createdAt: string;
  updatedAt: string;
  contentUrl?: string;
}

export interface EventMaterialUploadIntentRequest {
  filename: string;
  mimeType: string;
  size: number;
}

export interface EventMaterialUploadIntent {
  uploadToken: string;
  uploadUrl: string;
  expiresAt: string;
}

interface EventMaterialCreateBase {
  title: string;
  description?: string | null;
  visibility: EventMaterialVisibility;
  position?: number;
  isAvailable?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
}

export type CreateEventMaterialInput =
  | (EventMaterialCreateBase & {
      kind: 'LINK';
      externalUrl: string;
    })
  | (EventMaterialCreateBase & {
      kind: 'FILE';
      uploadToken: string;
    });

export interface UpdateEventMaterialInput {
  title?: string;
  description?: string | null;
  visibility?: EventMaterialVisibility;
  position?: number;
  isAvailable?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
}

export type EventCommunicationChannel = 'EMAIL' | 'SMS';
export type EventCommunicationAudience =
  | 'ACTIVE_REGISTERED'
  | 'PENDING'
  | 'APPROVED'
  | 'WAITLISTED'
  | 'DECLINED'
  | 'SELECTED';
export type EventCommunicationStatus =
  | 'DRAFT'
  | 'SENDING'
  | 'SENT'
  | 'PARTIAL'
  | 'FAILED';
export type EventCommunicationRecipientStatus =
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'FAILED';

export interface EventCommunication {
  id: EntityId;
  eventId: EntityId;
  createdById: EntityId;
  sentById: EntityId | null;
  channel: EventCommunicationChannel;
  status: EventCommunicationStatus;
  subject: string | null;
  body: string;
  audienceType: EventCommunicationAudience;
  audienceDefinition: JsonObject;
  previewFingerprint: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventCommunicationRecipient {
  id: EntityId;
  communicationId: EntityId;
  hackerId: EntityId;
  registrationId: EntityId;
  contactValue: string;
  displayName: string;
  status: EventCommunicationRecipientStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventCommunicationDraftInput {
  channel: EventCommunicationChannel;
  subject?: string | null;
  body: string;
  audienceType: EventCommunicationAudience;
  audienceDefinition?: JsonObject;
}

export interface EventCommunicationPreviewExclusions {
  cancelled: number;
  missingContact: number;
  preferenceDisabled: number;
  ineligible: number;
}

export interface EventCommunicationPreview {
  channel: EventCommunicationChannel;
  eligibleCount: number;
  exclusions: EventCommunicationPreviewExclusions;
  previewFingerprint: string;
}

export interface SendEventCommunicationInput {
  previewFingerprint: string;
}

export type EventProjectCardStatus =
  | 'DRAFT'
  | 'NEEDS_INFO'
  | 'SUBMITTED'
  | 'APPROVED';

export interface UpdateEventProjectCardInput {
  cardStatus: EventProjectCardStatus;
}
