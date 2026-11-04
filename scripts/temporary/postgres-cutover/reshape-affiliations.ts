/*
turso kept only open affiliations: a rejected or cancelled one was deleted and survived
only in its notifications, which pointed at rows through json ids. here closed
affiliations are rebuilt from that news, news points at its affiliation, club, user or
player through columns, and request news, which the club now sees as requests, is left
out. news that can't be attached to a row is dropped; the two are counted apart.
*/
import { AppError } from '@/lib/errors';
import { newid } from '@/lib/utils';
import type {
  club_notifications,
  user_notifications,
} from '@/server/db/schema/notifications';
import { type AffiliationStatus, statusInClubEnum } from '@/server/zod/enums';
import type { AffiliationInsertModel } from '@/server/zod/players';
import z from 'zod';

export type SourceAffiliation = Omit<AffiliationInsertModel, 'status'> & {
  status: string;
  createdAt: Date;
};
export type SourceNotification = {
  id: string;
  ownerId: string;
  event: string;
  isSeen: boolean;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

const REQUEST_EVENTS = new Set([
  'affiliation_request',
  'affiliation_request_approved',
  'affiliation_request_rejected',
]);
const STATUSES: Record<string, AffiliationStatus> = {
  requested_by_user: 'requested',
  active: 'approved',
};
const requestNews = z.object({
  affiliationId: z.string(),
  userId: z.string(),
  playerId: z.string(),
});
const decisionNews = z.object({ affiliationId: z.string() });
const userCancelNews = z.object({ userId: z.string(), playerId: z.string() });
const clubCancelNews = z.object({ clubId: z.string(), playerId: z.string() });
const managerNews = z.object({ clubId: z.string(), role: statusInClubEnum });
const managerLeftNews = z.object({ userId: z.string() });
const mergeNews = z.object({
  playerId: z.string(),
  mergedPlayerNickname: z.string(),
});

export function reshapeAffiliations({
  affiliations,
  clubNotifications,
  userNotifications,
  existing,
}: {
  affiliations: SourceAffiliation[];
  clubNotifications: SourceNotification[];
  userNotifications: SourceNotification[];
  existing: Record<'users' | 'players' | 'clubs', Set<string>>;
}) {
  const rows = new Map<string, AffiliationInsertModel & { createdAt: Date }>();
  for (const affiliation of affiliations) {
    const status = STATUSES[affiliation.status];
    if (!status) {
      throw new AppError('DATABASE_MIGRATION_ERROR', {
        cause: `affiliation ${affiliation.id}: status ${affiliation.status}`,
      });
    }
    rows.set(affiliation.id, { ...affiliation, status });
  }
  const exists = (userId: string, playerId: string, clubId: string) =>
    existing.users.has(userId) &&
    existing.players.has(playerId) &&
    existing.clubs.has(clubId);

  // the club's request news outlived the affiliations it was about: an approved
  // one without its row was cancelled later, a rejected one was deleted at once
  const rejectedAt = new Map<string, Date>();
  for (const news of userNotifications) {
    const metadata = decisionNews.safeParse(news.metadata);
    if (news.event === 'affiliation_rejected' && metadata.success) {
      rejectedAt.set(metadata.data.affiliationId, news.createdAt);
    }
  }
  for (const news of clubNotifications) {
    const rejected = news.event === 'affiliation_request_rejected';
    if (!rejected && news.event !== 'affiliation_request_approved') continue;
    const metadata = requestNews.safeParse(news.metadata);
    if (!metadata.success) continue;
    const { affiliationId, userId, playerId } = metadata.data;
    if (rows.has(affiliationId) || !exists(userId, playerId, news.ownerId)) {
      continue;
    }
    rows.set(affiliationId, {
      id: affiliationId,
      userId,
      playerId,
      clubId: news.ownerId,
      status: rejected ? 'rejected' : 'cancelled',
      createdAt: news.createdAt,
      updatedAt: rejected
        ? (rejectedAt.get(affiliationId) ?? news.createdAt)
        : news.createdAt,
    });
  }

  // cancellation news carried no affiliation id: it closes the latest cancelled
  // affiliation of the same user, player and club, or a new one if there is none
  const cancellations = [
    ...clubNotifications.flatMap((news) => {
      const metadata = userCancelNews.safeParse(news.metadata);
      if (news.event !== 'affiliation_cancelled' || !metadata.success) {
        return [];
      }
      return [{ news, ...metadata.data, clubId: news.ownerId }];
    }),
    ...userNotifications.flatMap((news) => {
      const metadata = clubCancelNews.safeParse(news.metadata);
      if (news.event !== 'affiliation_cancelled' || !metadata.success) {
        return [];
      }
      return [{ news, ...metadata.data, userId: news.ownerId }];
    }),
  ].toSorted((a, b) => a.news.createdAt.getTime() - b.news.createdAt.getTime());
  const cancelledAffiliation = new Map<string, string>();
  const matched = new Set<string>();
  for (const { news, userId, playerId, clubId } of cancellations) {
    if (!exists(userId, playerId, clubId)) continue;
    const affiliation = [...rows.values()]
      .filter(
        (row) =>
          row.status === 'cancelled' &&
          !matched.has(row.id) &&
          row.userId === userId &&
          row.playerId === playerId &&
          row.clubId === clubId &&
          row.createdAt <= news.createdAt,
      )
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .at(0) ?? {
      id: newid(),
      userId,
      playerId,
      clubId,
      status: 'cancelled' as const,
      createdAt: news.createdAt,
    };
    rows.set(affiliation.id, { ...affiliation, updatedAt: news.createdAt });
    matched.add(affiliation.id);
    cancelledAffiliation.set(news.id, affiliation.id);
  }

  const affiliationOf = (affiliationId: string | undefined) =>
    affiliationId && rows.has(affiliationId) ? affiliationId : null;
  const newsFields = ({
    id,
    event,
    isSeen,
    createdAt,
  }: SourceNotification) => ({
    id,
    isSeen,
    createdAt,
    event,
  });

  const userRows = userNotifications.flatMap(
    (source): (typeof user_notifications.$inferInsert)[] => {
      const base = { ...newsFields(source), userId: source.ownerId };
      switch (base.event) {
        case 'affiliation_approved':
        case 'affiliation_rejected': {
          const metadata = decisionNews.safeParse(source.metadata);
          const affiliationId = affiliationOf(metadata.data?.affiliationId);
          return affiliationId
            ? [{ ...base, event: base.event, affiliationId }]
            : [];
        }
        case 'affiliation_cancelled': {
          const affiliationId = cancelledAffiliation.get(source.id);
          return affiliationId
            ? [{ ...base, event: base.event, affiliationId }]
            : [];
        }
        case 'became_club_manager': {
          const metadata = managerNews.safeParse(source.metadata);
          if (!metadata.success || !existing.clubs.has(metadata.data.clubId)) {
            return [];
          }
          const { clubId, role } = metadata.data;
          return [{ ...base, event: base.event, clubId, metadata: { role } }];
        }
        default:
          return [];
      }
    },
  );

  const clubRows = clubNotifications.flatMap(
    (source): (typeof club_notifications.$inferInsert)[] => {
      const base = { ...newsFields(source), clubId: source.ownerId };
      switch (base.event) {
        case 'manager_left': {
          const metadata = managerLeftNews.safeParse(source.metadata);
          if (!metadata.success || !existing.users.has(metadata.data.userId)) {
            return [];
          }
          return [{ ...base, event: base.event, userId: metadata.data.userId }];
        }
        case 'affiliation_cancelled': {
          const affiliationId = cancelledAffiliation.get(source.id);
          return affiliationId
            ? [{ ...base, event: base.event, affiliationId }]
            : [];
        }
        case 'player_merged': {
          const metadata = mergeNews.safeParse(source.metadata);
          if (
            !metadata.success ||
            !existing.players.has(metadata.data.playerId)
          ) {
            return [];
          }
          const { playerId, mergedPlayerNickname } = metadata.data;
          return [
            {
              ...base,
              event: base.event,
              playerId,
              metadata: { mergedPlayerNickname },
            },
          ];
        }
        default:
          return [];
      }
    },
  );

  const requestNotifications = clubNotifications.filter(({ event }) =>
    REQUEST_EVENTS.has(event),
  ).length;
  return {
    affiliations: [...rows.values()],
    userNotifications: userRows,
    clubNotifications: clubRows,
    requestNotifications,
    droppedNotifications:
      userNotifications.length +
      clubNotifications.length -
      userRows.length -
      clubRows.length -
      requestNotifications,
  };
}
