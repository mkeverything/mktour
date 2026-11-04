import 'server-only';

import { AppError } from '@/lib/errors';

import { validateRequest } from '@/lib/auth/lucia';
import { newid } from '@/lib/utils';
import { db, type Database, type Transaction } from '@/server/db';
import { lockClubs } from '@/server/db/locks';
import {
  club_notifications,
  user_notifications,
} from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import {
  publishClubNotification,
  publishUserNotification,
} from '@/server/events';
import { openAffiliationStatusEnum } from '@/server/zod/enums';
import { AffiliationInsertModel } from '@/server/zod/players';
import { and, eq, type SQL } from 'drizzle-orm';
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
  if (!user) throw new AppError('UNAUTHENTICATED');
  if (user.id !== userId) throw new AppError('USER_MISMATCH');

  const player = await db.query.players.findFirst({
    where: { id: playerId },
    columns: { clubId: true },
  });
  if (!player) throw new AppError('PLAYER_NOT_FOUND');
  if (player.clubId !== clubId) throw new AppError('PLAYER_NOT_IN_CLUB');

  await insertOpenAffiliation(db, {
    id: newid(),
    userId,
    playerId,
    clubId,
    status: 'requested',
  });
  publishClubNotification(clubId);
  revalidatePath(`/player/${playerId}`);
}

export async function acceptAffiliationByClub({
  affiliationId,
  clubId,
}: {
  affiliationId: string;
  clubId: string;
}) {
  const affiliation = await db.transaction(async (tx) => {
    await lockClubs(tx, [clubId]);
    const affiliation = await lockRequestedAffiliation(
      tx,
      and(eq(affiliations.id, affiliationId), eq(affiliations.clubId, clubId)),
    );
    await tx
      .update(affiliations)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(affiliations.id, affiliationId));
    await tx
      .update(players)
      .set({ userId: affiliation.userId })
      .where(eq(players.id, affiliation.playerId));
    await tx.insert(user_notifications).values({
      id: newid(),
      userId: affiliation.userId,
      event: 'affiliation_approved',
      affiliationId,
    });
    return affiliation;
  });
  publishUserNotification(affiliation.userId);
  publishClubNotification(clubId);
  revalidatePath(`/player/${affiliation.playerId}`);
}

export async function rejectAffiliation({
  affiliationId,
  clubId,
}: {
  affiliationId: string;
  clubId: string;
}) {
  const affiliation = await db.transaction(async (tx) => {
    const affiliation = await lockRequestedAffiliation(
      tx,
      and(eq(affiliations.id, affiliationId), eq(affiliations.clubId, clubId)),
    );
    await tx
      .update(affiliations)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(affiliations.id, affiliationId));
    await tx.insert(user_notifications).values({
      id: newid(),
      userId: affiliation.userId,
      event: 'affiliation_rejected',
      affiliationId,
    });
    return affiliation;
  });
  publishUserNotification(affiliation.userId);
  publishClubNotification(clubId);
  revalidatePath(`/player/${affiliation.playerId}`);
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
  if (!user) throw new AppError('UNAUTHENTICATED');
  if (user.id !== userId) throw new AppError('USER_MISMATCH');

  const affiliation = await db.transaction(async (tx) => {
    const affiliation = await lockRequestedAffiliation(
      tx,
      and(eq(affiliations.id, affiliationId), eq(affiliations.userId, userId)),
    );
    await tx.delete(affiliations).where(eq(affiliations.id, affiliationId));
    return affiliation;
  });
  publishClubNotification(affiliation.clubId);
  revalidatePath(`/player/${playerId}`);
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
  await db.transaction(async (tx) => {
    await lockClubs(tx, [clubId]);
    const player = await tx.query.players.findFirst({
      where: { id: playerId },
      columns: { clubId: true },
    });
    if (!player) throw new AppError('PLAYER_NOT_FOUND');
    if (player.clubId !== clubId) throw new AppError('PLAYER_NOT_IN_CLUB');

    await insertOpenAffiliation(tx, {
      id: newid(),
      userId: user.id,
      playerId,
      clubId,
      status: 'approved',
    });
    await tx
      .update(players)
      .set({ userId: user.id })
      .where(eq(players.id, playerId));
  });
  publishClubNotification(clubId);
}

export async function cancelAffiliationByUser({
  playerId,
  userId,
}: {
  playerId: string;
  userId: string;
}) {
  const player = await db.query.players.findFirst({
    where: { id: playerId },
    columns: { clubId: true },
  });
  if (!player) throw new AppError('PLAYER_NOT_FOUND');

  await db.transaction(async (tx) => {
    await lockClubs(tx, [player.clubId]);
    const affiliation = await cancelApprovedAffiliation(
      tx,
      and(eq(affiliations.playerId, playerId), eq(affiliations.userId, userId)),
    );
    await tx.insert(club_notifications).values({
      id: newid(),
      clubId: player.clubId,
      event: 'affiliation_cancelled',
      affiliationId: affiliation.id,
    });
  });
  publishClubNotification(player.clubId);
}

export async function cancelAffiliationByClub({
  playerId,
  clubId,
  user,
}: {
  playerId: string;
  clubId: string;
  user: User;
}) {
  const notifiedUserId = await db.transaction(async (tx) => {
    await lockClubs(tx, [clubId]);
    const affiliation = await cancelApprovedAffiliation(
      tx,
      and(eq(affiliations.playerId, playerId), eq(affiliations.clubId, clubId)),
    );
    if (affiliation.userId === user.id) return null;
    await tx.insert(user_notifications).values({
      id: newid(),
      userId: affiliation.userId,
      event: 'affiliation_cancelled',
      affiliationId: affiliation.id,
    });
    return affiliation.userId;
  });
  if (notifiedUserId) publishUserNotification(notifiedUserId);
  publishClubNotification(clubId);
}

async function insertOpenAffiliation(
  database: Database,
  values: AffiliationInsertModel,
) {
  const [created] = await database
    .insert(affiliations)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: affiliations.id });
  if (created) return;

  const playerTaken = await database.query.affiliations.findFirst({
    where: {
      playerId: values.playerId,
      status: { in: openAffiliationStatusEnum.options },
    },
    columns: { id: true },
  });
  throw new AppError(playerTaken ? 'ALREADY_AFFILIATED' : 'AFFILIATION_EXISTS');
}

async function lockRequestedAffiliation(tx: Transaction, where?: SQL) {
  const [affiliation] = await tx
    .select()
    .from(affiliations)
    .where(where)
    .for('update');
  if (!affiliation) throw new AppError('AFFILIATION_NOT_FOUND');
  if (affiliation.status !== 'requested') {
    throw new AppError('AFFILIATION_STATUS_NOT_REQUESTED');
  }
  return affiliation;
}

async function cancelApprovedAffiliation(tx: Transaction, where?: SQL) {
  const [affiliation] = await tx
    .update(affiliations)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(where, eq(affiliations.status, 'approved')))
    .returning();
  if (!affiliation) throw new AppError('NO_AFFILIATION');
  await tx
    .update(players)
    .set({ userId: null })
    .where(eq(players.id, affiliation.playerId));
  return affiliation;
}
