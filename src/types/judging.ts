import type { EntityId } from './event-management';

export const JUDGING_SCORE_MIN = 1;
export const JUDGING_SCORE_MAX = 5;
export const ADDITIONAL_INFO_KEY = 'additionalInfo';
/** Query parameter that carries a judge's magic-link token. */
export const JUDGE_TOKEN_PARAM = 'judge';
/** Header the judging panel uses to send the token to the judging API. */
export const JUDGE_TOKEN_HEADER = 'x-judge-token';

export interface JudgingQuestion {
  id: string;
  prompt: string;
  required: boolean;
}

/** Answers keyed by question id, plus the always-present additional info. */
export type JudgingAnswers = Record<string, string>;

export interface JudgingCriterionConfig {
  id: EntityId;
  trackId: EntityId | null;
  name: string;
  description: string | null;
  weight: number;
}

export interface JudgingTrackConfig {
  id: EntityId;
  name: string;
  description: string | null;
  questions: JudgingQuestion[];
  criteria: JudgingCriterionConfig[];
  submissionCount: number;
}

export interface JudgingSettings {
  judgingEnabled: boolean;
  judgingOpen: boolean;
  judgingSubmissionsOpenAt: string | null;
  judgingSubmissionsCloseAt: string | null;
}

export interface EventJudgeSummary {
  id: EntityId;
  email: string;
  name: string | null;
  hackerId: EntityId | null;
  trackIds: EntityId[];
  invitedAt: string;
  lastSentAt: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  reviewCount: number;
}

export interface EventJudgingConfig extends JudgingSettings {
  eventStartTime: string;
  eventEndTime: string | null;
  timezone: string;
  /** Criteria that apply to every track. */
  criteria: JudgingCriterionConfig[];
  tracks: JudgingTrackConfig[];
  judges: EventJudgeSummary[];
}

/** Body accepted by PUT /api/events/[eventId]/judging. Ids are omitted for new rows. */
export interface JudgingConfigInput extends JudgingSettings {
  criteria: Array<
    Omit<JudgingCriterionConfig, 'id' | 'trackId'> & { id?: string }
  >;
  tracks: Array<{
    id?: string;
    name: string;
    description: string | null;
    questions: JudgingQuestion[];
    criteria: Array<
      Omit<JudgingCriterionConfig, 'id' | 'trackId'> & { id?: string }
    >;
  }>;
}

/** Shown to participants when they submit a project to a judging event. */
export interface ProjectJudgingOption {
  tracks: Array<{
    id: EntityId;
    name: string;
    description: string | null;
    questions: JudgingQuestion[];
  }>;
  submission: { trackId: EntityId; answers: JudgingAnswers } | null;
}

export interface JudgeProjectView {
  submissionId: EntityId;
  projectId: EntityId;
  trackId: EntityId;
  title: string;
  preview: string;
  thumbnailUrl: string | null;
  githubUrl: string | null;
  demoUrl: string | null;
  blogUrl: string | null;
  team: string[];
  answers: Array<{ prompt: string; answer: string }>;
  review: {
    scores: Record<EntityId, number>;
    comment: string;
    updatedAt: string;
  } | null;
}

export interface JudgePanelPayload {
  judge: { id: EntityId; name: string | null; email: string };
  judgingOpen: boolean;
  scoreMin: number;
  scoreMax: number;
  tracks: Array<{
    id: EntityId;
    name: string;
    description: string | null;
    criteria: JudgingCriterionConfig[];
    projects: JudgeProjectView[];
  }>;
}

export interface JudgingLeaderboardRow {
  submissionId: EntityId;
  projectId: EntityId;
  title: string;
  trackId: EntityId;
  trackName: string;
  judgeCount: number;
  assignedJudgeCount: number;
  rawScore: number | null;
  normalizedScore: number | null;
  criterionAverages: Record<EntityId, number>;
  reviews: Array<{
    judgeId: EntityId;
    judgeName: string;
    score: number | null;
    scores: Record<EntityId, number>;
    comment: string | null;
  }>;
}

export interface JudgingResults {
  scoreMin: number;
  scoreMax: number;
  overall: JudgingLeaderboardRow[];
  tracks: Array<{
    id: EntityId;
    name: string;
    criteria: JudgingCriterionConfig[];
    rows: JudgingLeaderboardRow[];
  }>;
}
