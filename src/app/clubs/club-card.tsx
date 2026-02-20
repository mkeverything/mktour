import LichessLogo from '@/components/ui-custom/lichess-logo';
import { Card, CardTitle } from '@/components/ui/card';
import { ClubModel } from '@/server/db/zod/clubs';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { FC } from 'react';

const ClubCard: FC<{ club: ClubModel }> = async ({ club }) => {
  const t = await getTranslations();
  const locale = await getLocale();

  return (
    <Link href={`/clubs/${club.id}`}>
      <Card className="mk-card flex flex-col shadow-sm">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{club.name}</CardTitle>
          {club.lichessTeam && (
            <div className="size-4">
              <LichessLogo />
            </div>
          )}
        </div>
        {club.description && (
          <span className="text-muted-foreground">
            {club.description || t('Club.Page.no description')}
          </span>
        )}

        <p className="text-muted-foreground text-xs">
          {club.createdAt &&
            t('Club.Page.createdAt', {
              date: club.createdAt.toLocaleDateString(locale, {
                dateStyle: 'long',
              }),
            })}
        </p>
      </Card>
    </Link>
  );
};

export default ClubCard;
