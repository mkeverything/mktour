'use server';

import { validateRequest } from '@/lib/auth/lucia';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import {
  club_notifications,
  user_notifications,
} from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import {
  ClubNotificationInsertModel,
  UserNotificationInsertModel,
} from '@/server/db/zod/notifications';
import { AffiliationInsertModel } from '@/server/db/zod/players';
import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';
import { User } from 'lucia';
import { revalidatePath } from 'next/cache';

export async function requestAffiliation({
  playerId,
  userId,
  clubId,
}: {
  playerId: string;
  userId: string;
  clubId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');

  const [existingPlayers, existingAffiliations] = await Promise.all([
    db
      .select()
      .from(players)
      .where(and(eq(players.userId, userId), eq(players.clubId, clubId))),
    db
      .select()
      .from(affiliations)
      .where(
        and(eq(affiliations.userId, userId), eq(affiliations.clubId, clubId)),
      ),
  ]);
  if (existingAffiliations.at(0) || existingPlayers.at(0))
    throw new Error('AFFILIATION_EXISTS');

  const createdAt = new Date();

  const newAffiliation: AffiliationInsertModel = {
    id: newid(),
    userId: userId,
    playerId: playerId,
    clubId: clubId,
    status: 'requested_by_user',
    createdAt,
    updatedAt: createdAt,
  };

  const newNotification: ClubNotificationInsertModel = {
    id: newid(),
    clubId: clubId,
    event: 'affiliation_request',
    isSeen: false,
    createdAt,
    metadata: { affiliationId: newAffiliation.id, userId, playerId },
  };

  await Promise.all([
    db.insert(affiliations).values(newAffiliation),
    db.insert(club_notifications).values(newNotification),
  ]);
  revalidatePath(`/player/${playerId}`);
}

export async function acceptAffiliationByClub({
  affiliationId,
  notificationId,
}: {
  affiliationId: string;
  notificationId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');

  const affiliation = await db.query.affiliations.findFirst({
    where: eq(affiliations.id, affiliationId),
  });

  if (!affiliation) throw new Error('AFFILIATION_NOT_FOUND');
  if (affiliation.clubId !== user.selectedClub)
    throw new Error('CLUB_ID_NOT_MATCHING');
  if (affiliation.status !== 'requested_by_user')
    throw new Error('AFFILIATION_STATUS_NOT_REQUESTED');

  const newNotification: UserNotificationInsertModel = {
    id: newid(),
    userId: affiliation.userId,
    event: 'affiliation_approved',
    isSeen: false,
    createdAt: new Date(),
    metadata: { clubId: affiliation.clubId, affiliationId: affiliationId },
  };

  await Promise.all([
    db
      .update(affiliations)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(affiliations.id, affiliationId)),
    db
      .update(players)
      .set({ userId: affiliation.userId })
      .where(eq(players.id, affiliation.playerId)),
    db
      .update(club_notifications)
      .set({ isSeen: true, event: 'affiliation_request_approved' })
      .where(eq(club_notifications.id, notificationId)),
    db.insert(user_notifications).values(newNotification),
  ]);
  revalidatePath(`/player/${affiliation.playerId}`);

  return affiliation;
}

export async function rejectAffiliation({
  affiliationId,
  notificationId,
}: {
  affiliationId: string;
  notificationId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');

  const affiliation = await db.query.affiliations.findFirst({
    where: eq(affiliations.id, affiliationId),
  });
  if (!affiliation) throw new Error('AFFILIATION_NOT_FOUND');
  if (affiliation.clubId !== user.selectedClub)
    throw new Error('CLUB_ID_NOT_MATCHING');
  if (affiliation.status !== 'requested_by_user')
    throw new Error('AFFILIATION_STATUS_NOT_REQUESTED');

  const newNotification: UserNotificationInsertModel = {
    id: newid(),
    userId: affiliation.userId,
    event: 'affiliation_rejected',
    isSeen: false,
    createdAt: new Date(),
    metadata: { clubId: affiliation.clubId, affiliationId: affiliationId },
  };

  await Promise.all([
    db.delete(affiliations).where(eq(affiliations.id, affiliationId)),
    db
      .update(club_notifications)
      .set({ isSeen: true, event: 'affiliation_request_rejected' })
      .where(eq(club_notifications.id, notificationId)),
    db.insert(user_notifications).values(newNotification),
  ]);
  revalidatePath(`/player/${affiliation.playerId}`);

  return affiliation;
}
export async function abortAffiliationRequest({
  userId,
  playerId,
  affiliationId,
}: {
  userId: string;
  playerId: string;
  affiliationId: string;
}) {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');

  const affiliation = await db.query.affiliations.findFirst({
    where: eq(affiliations.id, affiliationId),
  });
  if (!affiliation) throw new Error('AFFILIATION_NOT_FOUND');
  if (affiliation.status !== 'requested_by_user')
    throw new Error('AFFILIATION_STATUS_NOT_REQUESTED');

  await Promise.all([
    db.delete(affiliations).where(eq(affiliations.id, affiliationId)),
    db
      .delete(club_notifications)
      .where(
        sql`json_extract(${club_notifications.metadata}, '$.affiliationId') = ${affiliationId}`,
      ),
  ]);
  revalidatePath(`/player/${playerId}`);

  return affiliation;
}

export async function affiliateUser({
  playerId,
  user,
  clubId,
}: {
  playerId: string;
  user: User;
  clubId: string;
}) {
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player) throw new Error('PLAYER_NOT_FOUND');

  const existingAffiliation = await db.query.affiliations.findFirst({
    where: and(
      eq(affiliations.userId, user.id),
      eq(affiliations.clubId, clubId),
    ),
  });

  if (existingAffiliation?.status === 'active')
    throw new Error('ALREADY_AFFILIATED');

  // if user has a pending request, update it to active; otherwise create new
  const affiliationQuery = existingAffiliation
    ? db
        .update(affiliations)
        .set({
          status: 'active',
          playerId: playerId,
          updatedAt: new Date(),
        })
        .where(eq(affiliations.id, existingAffiliation.id))
    : db.insert(affiliations).values({
        id: newid(),
        userId: user.id,
        playerId: playerId,
        clubId: clubId,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

  await Promise.all([
    affiliationQuery,
    db.update(players).set({ userId: user.id }).where(eq(players.id, playerId)),
  ]);

  return player;
}

export async function cancelAffiliationByUser({
  playerId,
  userId,
}: {
  playerId: string;
  userId: string;
}) {
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player)
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'PLAYER_NOT_FOUND' });
  if (player.userId !== userId) throw new TRPCError({ code: 'BAD_REQUEST' });

  await Promise.all([
    db
      .delete(affiliations)
      .where(
        and(
          eq(affiliations.playerId, playerId),
          eq(affiliations.userId, userId),
        ),
      ),
    db.update(players).set({ userId: null }).where(eq(players.id, playerId)),
    db.insert(club_notifications).values({
      id: newid(),
      clubId: player.clubId,
      event: 'affiliation_cancelled',
      isSeen: false,
      createdAt: new Date(),
      metadata: { playerId: playerId, userId: userId },
    }),
  ]);

  return player;
}
