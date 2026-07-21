import prisma from "@/lib/prisma";
import type {
  BanFlagStatus,
  EntityId,
  UserBan,
  UserBanFlag,
} from "@/types/event-management";

export const BLOCKED_REGISTRATION_MESSAGE =
  "You are unable to register for this event at this time.";

type CreateGlobalBanInput = {
  hackerId: EntityId;
  createdById: EntityId;
  publicSafeReason?: string;
  internalNote?: string | null;
};

type RevokeGlobalBanInput = {
  banId: EntityId;
  revokedById: EntityId;
  revocationReason?: string | null;
  revokedAt?: Date;
};

type CreateBanFlagInput = {
  chapterId: EntityId;
  hackerId: EntityId;
  createdById: EntityId;
  reason: string;
};

type BanFlagResolutionStatus = Extract<
  BanFlagStatus,
  "RESOLVED_NO_ACTION" | "RESOLVED_BANNED" | "DISMISSED"
>;

type ResolveBanFlagInput = {
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
