import prisma from "@/lib/prisma";
import type {
  Chapter,
  ChapterAccessMode,
  ChapterMembership,
  ChapterMembershipStatus,
  ChapterRole,
  ChapterStatus,
  EntityId,
  JsonObject,
  Role,
} from "@/types/event-management";

const ACTIVE_CHAPTER_STATUS: ChapterStatus = "ACTIVE";
const PUBLIC_CHAPTER_ACCESS: ChapterAccessMode = "PUBLIC";
const PRIVATE_CHAPTER_ACCESS: ChapterAccessMode = "PRIVATE";
const ACTIVE_MEMBERSHIP_STATUS: ChapterMembershipStatus = "ACTIVE";
const INVITED_MEMBERSHIP_STATUS: ChapterMembershipStatus = "INVITED";
const MEMBER_CHAPTER_ROLE: ChapterRole = "MEMBER";
const ADMIN_CHAPTER_ROLE: ChapterRole = "ADMIN";
const PRIVATE_VISIBLE_MEMBERSHIP_STATUSES: ChapterMembershipStatus[] = [
  INVITED_MEMBERSHIP_STATUS,
  ACTIVE_MEMBERSHIP_STATUS,
];

type LooseWhere = Record<string, unknown>;
type LooseArgs = Record<string, unknown>;

type PlannedDelegate = {
  findMany(args?: LooseArgs): Promise<unknown[]>;
  findFirst(args?: LooseArgs): Promise<unknown | null>;
  findUnique(args?: LooseArgs): Promise<unknown | null>;
  create(args: LooseArgs): Promise<unknown>;
  update(args: LooseArgs): Promise<unknown>;
  count(args?: LooseArgs): Promise<number>;
};

export type PlannedPrismaClient = {
  chapter: PlannedDelegate;
  chapterMembership: PlannedDelegate;
  $transaction<T>(fn: (tx: PlannedPrismaClient) => Promise<T>): Promise<T>;
};

export type ChapterViewer = {
  id?: EntityId | null;
  role?: Role | null;
} | null;

export type ChapterNotificationPreferenceInput = {
  notificationsAllowed?: boolean;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  notificationPreferencesJson?: JsonObject | null;
};

export type ChapterMembershipPreferenceInput = ChapterNotificationPreferenceInput;

export type ListVisibleChaptersOptions = {
  viewer?: ChapterViewer;
  includeViewerMembership?: boolean;
  where?: LooseWhere;
  orderBy?: unknown;
  prismaClient?: PlannedPrismaClient;
};

type ChapterErrorCode =
  | "CHAPTER_NOT_FOUND"
  | "CHAPTER_NOT_JOINABLE"
  | "PRIVATE_INVITE_REQUIRED"
  | "ACTIVE_MEMBERSHIP_REQUIRED"
  | "ONLY_ACTIVE_CHAPTER_ADMIN"
  | "NOT_ACTIVE_CHAPTER_ADMIN"
  | "CHAPTER_REQUIRES_ACTIVE_ADMIN";

class ChapterHelperError extends Error {
  readonly code: ChapterErrorCode;
  readonly status: number;

  constructor(code: ChapterErrorCode, message: string, status = 400) {
    super(message);
    this.name = "ChapterHelperError";
    this.code = code;
    this.status = status;
  }
}

const plannedPrisma = prisma as unknown as PlannedPrismaClient;

const now = () => new Date();

const asChapter = (value: unknown): Chapter | null => {
  return value ? (value as Chapter) : null;
};

const asMembership = (value: unknown): ChapterMembership | null => {
  return value ? (value as ChapterMembership) : null;
};

const andWhere = (...clauses: Array<LooseWhere | undefined>): LooseWhere => {
  const presentClauses = clauses.filter((clause): clause is LooseWhere => Boolean(clause));

  if (presentClauses.length === 0) return {};
  if (presentClauses.length === 1) return presentClauses[0];

  return { AND: presentClauses };
};

export function normalizeChapterSlug(input: string): string {
  const normalized = input
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "chapter";
}

function activeChapterWhere(): LooseWhere {
  return { status: ACTIVE_CHAPTER_STATUS };
}

export function publicChapterWhere(): LooseWhere {
  return {
    ...activeChapterWhere(),
    accessMode: PUBLIC_CHAPTER_ACCESS,
  };
}

export async function resolveChapterId(
  chapterIdOrSlug: EntityId,
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<EntityId | null> {
  const chapterById = (await prismaClient.chapter.findUnique({
    where: { id: chapterIdOrSlug },
    select: { id: true },
  })) as Pick<Chapter, "id"> | null;

  if (chapterById) return chapterById.id;

  const chapterBySlug = (await prismaClient.chapter.findUnique({
    where: { slug: chapterIdOrSlug },
    select: { id: true },
  })) as Pick<Chapter, "id"> | null;

  return chapterBySlug?.id ?? null;
}

function privateChapterWhere(): LooseWhere {
  return {
    ...activeChapterWhere(),
    accessMode: PRIVATE_CHAPTER_ACCESS,
  };
}

export function activeChapterAdminMembershipWhere(chapterId?: EntityId, hackerId?: EntityId): LooseWhere {
  return {
    ...(chapterId ? { chapterId } : {}),
    ...(hackerId ? { hackerId } : {}),
    role: ADMIN_CHAPTER_ROLE,
    status: ACTIVE_MEMBERSHIP_STATUS,
  };
}

export function visibleChapterWhere(viewer?: ChapterViewer): LooseWhere {
  if (viewer?.role === "SITE_ADMIN") return {};

  if (!viewer?.id) return publicChapterWhere();

  return {
    OR: [
      publicChapterWhere(),
      {
        ...privateChapterWhere(),
        memberships: {
          some: {
            hackerId: viewer.id,
            status: { in: PRIVATE_VISIBLE_MEMBERSHIP_STATUSES },
          },
        },
      },
      {
        memberships: {
          some: activeChapterAdminMembershipWhere(undefined, viewer.id),
        },
      },
    ],
  };
}

export async function listVisibleChapters(options: ListVisibleChaptersOptions = {}): Promise<Chapter[]> {
  const client = options.prismaClient ?? plannedPrisma;
  const viewer = options.viewer ?? null;
  const viewerId = viewer?.id ?? null;
  const where = andWhere(visibleChapterWhere(viewer), options.where);

  const chapters = await client.chapter.findMany({
    where,
    orderBy: options.orderBy ?? { name: "asc" },
    ...(options.includeViewerMembership && viewerId
      ? {
          include: {
            memberships: {
              where: { hackerId: viewerId },
              take: 1,
            },
          },
        }
      : {}),
  });

  return chapters as Chapter[];
}

export async function joinOrReactivatePublicMembership(
  chapterId: EntityId,
  hackerId: EntityId,
  preferences: ChapterMembershipPreferenceInput = {},
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<ChapterMembership> {
  return prismaClient.$transaction(async (tx) => {
    const chapter = asChapter(
      await tx.chapter.findUnique({
        where: { id: chapterId },
        select: { id: true, status: true, accessMode: true },
      })
    );

    if (!chapter) {
      throw new ChapterHelperError("CHAPTER_NOT_FOUND", "Chapter not found.", 404);
    }

    if (chapter.status !== ACTIVE_CHAPTER_STATUS || chapter.accessMode !== PUBLIC_CHAPTER_ACCESS) {
      throw new ChapterHelperError(
        "CHAPTER_NOT_JOINABLE",
        "Only active public chapters can be joined directly.",
        400
      );
    }

    const existing = asMembership(
      await tx.chapterMembership.findUnique({
        where: { chapterId_hackerId: { chapterId, hackerId } },
      })
    );

    if (existing?.status === ACTIVE_MEMBERSHIP_STATUS) {
      return existing;
    }

    const joinedAt = now();
    const data = membershipActivationData(joinedAt, preferences, {
      role: MEMBER_CHAPTER_ROLE,
      invitedById: null,
      invitedAt: null,
    });

    if (existing) {
      return (await tx.chapterMembership.update({
        where: { id: existing.id },
        data,
      })) as ChapterMembership;
    }

    return (await tx.chapterMembership.create({
      data: {
        chapterId,
        hackerId,
        ...data,
      },
    })) as ChapterMembership;
  });
}

export async function acceptPrivateChapterInvite(
  chapterId: EntityId,
  hackerId: EntityId,
  preferences: ChapterMembershipPreferenceInput = {},
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<ChapterMembership> {
  return prismaClient.$transaction(async (tx) => {
    const chapter = asChapter(
      await tx.chapter.findUnique({
        where: { id: chapterId },
        select: { id: true, status: true, accessMode: true },
      })
    );

    if (!chapter) {
      throw new ChapterHelperError("CHAPTER_NOT_FOUND", "Chapter not found.", 404);
    }

    if (chapter.status !== ACTIVE_CHAPTER_STATUS || chapter.accessMode !== PRIVATE_CHAPTER_ACCESS) {
      throw new ChapterHelperError(
        "PRIVATE_INVITE_REQUIRED",
        "Only active private chapter invitations can be accepted.",
        403
      );
    }

    const membership = asMembership(
      await tx.chapterMembership.findFirst({
        where: {
          chapterId,
          hackerId,
          status: INVITED_MEMBERSHIP_STATUS,
        },
      })
    );

    if (!membership) {
      throw new ChapterHelperError(
        "PRIVATE_INVITE_REQUIRED",
        "An active invitation is required to join this chapter.",
        403
      );
    }

    return (await tx.chapterMembership.update({
      where: { id: membership.id },
      data: membershipActivationData(now(), preferences, { role: membership.role }),
    })) as ChapterMembership;
  });
}

export async function leaveChapterWithAdminGuard(
  chapterId: EntityId,
  hackerId: EntityId,
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<ChapterMembership> {
  return prismaClient.$transaction(async (tx) => {
    const membership = asMembership(
      await tx.chapterMembership.findUnique({
        where: { chapterId_hackerId: { chapterId, hackerId } },
      })
    );

    if (!membership || membership.status !== ACTIVE_MEMBERSHIP_STATUS) {
      throw new ChapterHelperError(
        "ACTIVE_MEMBERSHIP_REQUIRED",
        "Only active memberships can leave a chapter.",
        400
      );
    }

    if (membership.role === ADMIN_CHAPTER_ROLE) {
      await assertChapterKeepsActiveAdmin(chapterId, hackerId, tx);
    }

    return (await tx.chapterMembership.update({
      where: { id: membership.id },
      data: {
        status: "LEFT" satisfies ChapterMembershipStatus,
        leftAt: now(),
        notificationsAllowed: false,
        emailNotificationsEnabled: false,
        smsNotificationsEnabled: false,
      },
    })) as ChapterMembership;
  });
}

export async function updateChapterNotificationPreferences(
  chapterId: EntityId,
  hackerId: EntityId,
  preferences: ChapterNotificationPreferenceInput,
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<ChapterMembership> {
  const membership = asMembership(
    await prismaClient.chapterMembership.findFirst({
      where: {
        chapterId,
        hackerId,
        status: ACTIVE_MEMBERSHIP_STATUS,
      },
      select: { id: true },
    })
  );

  if (!membership) {
    throw new ChapterHelperError(
      "ACTIVE_MEMBERSHIP_REQUIRED",
      "Notification preferences can only be updated for active memberships.",
      400
    );
  }

  return (await prismaClient.chapterMembership.update({
    where: { id: membership.id },
    data: notificationPreferenceData(preferences),
  })) as ChapterMembership;
}

async function countActiveChapterAdmins(
  chapterId: EntityId,
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<number> {
  return prismaClient.chapterMembership.count({
    where: activeChapterAdminMembershipWhere(chapterId),
  });
}

async function hasActiveChapterAdmin(
  chapterId: EntityId,
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<boolean> {
  return (await countActiveChapterAdmins(chapterId, prismaClient)) > 0;
}

async function isActiveChapterAdmin(
  chapterId: EntityId,
  hackerId: EntityId,
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<boolean> {
  const membership = await prismaClient.chapterMembership.findFirst({
    where: activeChapterAdminMembershipWhere(chapterId, hackerId),
    select: { id: true },
  });

  return Boolean(membership);
}

async function isOnlyActiveChapterAdmin(
  chapterId: EntityId,
  hackerId: EntityId,
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<boolean> {
  const isAdmin = await isActiveChapterAdmin(chapterId, hackerId, prismaClient);
  if (!isAdmin) return false;

  return (await countActiveChapterAdmins(chapterId, prismaClient)) <= 1;
}

async function assertChapterKeepsActiveAdmin(
  chapterId: EntityId,
  removedHackerId: EntityId,
  prismaClient: PlannedPrismaClient = plannedPrisma
): Promise<void> {
  if (!(await isOnlyActiveChapterAdmin(chapterId, removedHackerId, prismaClient))) return;

  throw new ChapterHelperError(
    "ONLY_ACTIVE_CHAPTER_ADMIN",
    "Cannot remove or deactivate the only active chapter admin.",
    400
  );
}

function membershipActivationData(
  joinedAt: Date,
  preferences: ChapterMembershipPreferenceInput,
  extraData: LooseWhere = {}
): LooseWhere {
  return {
    role: MEMBER_CHAPTER_ROLE,
    status: ACTIVE_MEMBERSHIP_STATUS,
    joinedAt,
    leftAt: null,
    revokedAt: null,
    ...notificationPreferenceData({
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      notificationPreferencesJson: {},
      ...preferences,
    }),
    ...extraData,
  };
}

function notificationPreferenceData(preferences: ChapterNotificationPreferenceInput): LooseWhere {
  const data: LooseWhere = {};

  if (preferences.notificationsAllowed !== undefined) {
    data.notificationsAllowed = preferences.notificationsAllowed;
  }

  if (preferences.emailNotificationsEnabled !== undefined) {
    data.emailNotificationsEnabled = preferences.emailNotificationsEnabled;
  }

  if (preferences.smsNotificationsEnabled !== undefined) {
    data.smsNotificationsEnabled = preferences.smsNotificationsEnabled;
  }

  if (preferences.notificationPreferencesJson !== undefined) {
    data.notificationPreferencesJson = preferences.notificationPreferencesJson;
  }

  if (preferences.notificationsAllowed === false) {
    data.emailNotificationsEnabled = false;
    data.smsNotificationsEnabled = false;
  }

  return data;
}
