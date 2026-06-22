import prisma from "@/lib/prisma";
import type {
  BanFlagStatus,
  EntityId,
  UserBan,
  UserBanFlag,
} from "@/types/event-management";

export const BLOCKED_REGISTRATION_MESSAGE =
  "You are unable to register for this event at this time.";

export type ActiveBanCheck = {
  isBanned: boolean;
  ban: UserBan | null;
  blockedMessage: typeof BLOCKED_REGISTRATION_MESSAGE;
};

export type BanFilteredRegistration = {
  hackerId: EntityId;
};

export type BanFilteredHacker = {
  id: EntityId;
};

export type CreateGlobalBanInput = {
  hackerId: EntityId;
  createdById: EntityId;
  publicSafeReason?: string;
  internalNote?: string | null;
};

export type RevokeGlobalBanInput = {
  banId: EntityId;
  revokedById: EntityId;
  revocationReason?: string | null;
  revokedAt?: Date;
};

export type CreateBanFlagInput = {
  chapterId: EntityId;
  hackerId: EntityId;
  createdById: EntityId;
  reason: string;
};

export type BanFlagResolutionStatus = Extract<
  BanFlagStatus,
  "RESOLVED_NO_ACTION" | "RESOLVED_BANNED" | "DISMISSED"
>;

export type ResolveBanFlagInput = {
  flagId: EntityId;
  resolvedById: EntityId;
  status: BanFlagResolutionStatus;
  resolutionNote?: string | null;
  resolvedAt?: Date;
};

type QueryOrder = "asc" | "desc";
type QueryWhere = Record<string, unknown>;
type QueryInclude = Record<string, unknown>;
type QuerySelect = Record<string, unknown>;
type QueryOrderBy = Record<string, QueryOrder> | Record<string, QueryOrder>[];

type FindArgs = {
  where?: QueryWhere;
  include?: QueryInclude;
  select?: QuerySelect;
  orderBy?: QueryOrderBy;
  skip?: number;
  take?: number;
};

type CreateArgs = {
  data: QueryWhere;
  include?: QueryInclude;
  select?: QuerySelect;
};

type UpdateArgs = {
  where: QueryWhere;
  data: QueryWhere;
  include?: QueryInclude;
  select?: QuerySelect;
};

type ModerationModelDelegate<TRecord> = {
  findFirst(args: FindArgs): Promise<TRecord | null>;
  findMany(args?: FindArgs): Promise<TRecord[]>;
  create(args: CreateArgs): Promise<TRecord>;
  update(args: UpdateArgs): Promise<TRecord>;
};

type ModerationPrismaClient = typeof prisma & {
  userBan: ModerationModelDelegate<UserBan>;
  userBanFlag: ModerationModelDelegate<UserBanFlag>;
};

const moderationPrisma = prisma as ModerationPrismaClient;

const uniqueIds = (ids: readonly EntityId[]): EntityId[] =>
  Array.from(new Set(ids.filter(Boolean)));

export const activeUserBanWhere = (hackerId: EntityId): QueryWhere => ({
  hackerId,
  revokedAt: null,
});

export const activeUserBanListWhere = (
  hackerIds: readonly EntityId[]
): QueryWhere => ({
  hackerId: {
    in: uniqueIds(hackerIds),
  },
  revokedAt: null,
});

export async function getActiveGlobalBanForHacker(
  hackerId: EntityId
): Promise<UserBan | null> {
  return moderationPrisma.userBan.findFirst({
    where: activeUserBanWhere(hackerId),
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function checkActiveGlobalBan(
  hackerId: EntityId
): Promise<ActiveBanCheck> {
  const ban = await getActiveGlobalBanForHacker(hackerId);

  return {
    isBanned: ban !== null,
    ban,
    blockedMessage: BLOCKED_REGISTRATION_MESSAGE,
  };
}

export async function isHackerGloballyBanned(
  hackerId: EntityId
): Promise<boolean> {
  const ban = await getActiveGlobalBanForHacker(hackerId);
  return ban !== null;
}

export async function getActiveGlobalBanMap(
  hackerIds: readonly EntityId[]
): Promise<Map<EntityId, UserBan>> {
  const ids = uniqueIds(hackerIds);

  if (ids.length === 0) {
    return new Map();
  }

  const bans = await moderationPrisma.userBan.findMany({
    where: activeUserBanListWhere(ids),
    orderBy: {
      createdAt: "desc",
    },
  });

  const bansByHackerId = new Map<EntityId, UserBan>();

  for (const ban of bans) {
    if (!bansByHackerId.has(ban.hackerId)) {
      bansByHackerId.set(ban.hackerId, ban);
    }
  }

  return bansByHackerId;
}

export async function getActiveGloballyBannedHackerIds(
  hackerIds: readonly EntityId[]
): Promise<Set<EntityId>> {
  const banMap = await getActiveGlobalBanMap(hackerIds);
  return new Set(banMap.keys());
}

export async function filterRegistrationsForBanVisibility<
  TRegistration extends BanFilteredRegistration,
>(
  registrations: readonly TRegistration[],
  options: { isSiteAdmin: boolean }
): Promise<TRegistration[]> {
  if (options.isSiteAdmin || registrations.length === 0) {
    return [...registrations];
  }

  const bannedHackerIds = await getActiveGloballyBannedHackerIds(
    registrations.map((registration) => registration.hackerId)
  );

  return registrations.filter(
    (registration) => !bannedHackerIds.has(registration.hackerId)
  );
}

export async function filterHackersForBanVisibility<
  THacker extends BanFilteredHacker,
>(
  hackers: readonly THacker[],
  options: { isSiteAdmin: boolean }
): Promise<THacker[]> {
  if (options.isSiteAdmin || hackers.length === 0) {
    return [...hackers];
  }

  const bannedHackerIds = await getActiveGloballyBannedHackerIds(
    hackers.map((hacker) => hacker.id)
  );

  return hackers.filter((hacker) => !bannedHackerIds.has(hacker.id));
}

export function buildActiveBanExclusionWhere(
  isSiteAdmin: boolean,
  options: { hackerRelation?: string | null } = {}
): QueryWhere {
  if (isSiteAdmin) {
    return {};
  }

  const banRelationWhere = {
    userBans: {
      none: {
        revokedAt: null,
      },
    },
  };

  if (options.hackerRelation === null) {
    return banRelationWhere;
  }

  return {
    [options.hackerRelation ?? "hacker"]: banRelationWhere,
  };
}

export async function createGlobalBan(
  input: CreateGlobalBanInput
): Promise<UserBan> {
  return moderationPrisma.userBan.create({
    data: {
      hackerId: input.hackerId,
      createdById: input.createdById,
      publicSafeReason:
        input.publicSafeReason ?? BLOCKED_REGISTRATION_MESSAGE,
      internalNote: input.internalNote ?? null,
    },
    include: {
      hacker: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function revokeGlobalBan(
  input: RevokeGlobalBanInput
): Promise<UserBan> {
  return moderationPrisma.userBan.update({
    where: {
      id: input.banId,
    },
    data: {
      revokedById: input.revokedById,
      revokedAt: input.revokedAt ?? new Date(),
      revocationReason: input.revocationReason ?? null,
    },
  });
}

export async function createBanFlag(
  input: CreateBanFlagInput
): Promise<UserBanFlag> {
  return moderationPrisma.userBanFlag.create({
    data: {
      chapterId: input.chapterId,
      hackerId: input.hackerId,
      createdById: input.createdById,
      reason: input.reason,
      status: "OPEN",
    },
  });
}

export async function resolveBanFlag(
  input: ResolveBanFlagInput
): Promise<UserBanFlag> {
  return moderationPrisma.userBanFlag.update({
    where: {
      id: input.flagId,
    },
    data: {
      status: input.status,
      resolutionNote: input.resolutionNote ?? null,
      resolvedById: input.resolvedById,
      resolvedAt: input.resolvedAt ?? new Date(),
    },
  });
}
