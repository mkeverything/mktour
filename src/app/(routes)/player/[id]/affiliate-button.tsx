'use client';

import { LoadingSpinner } from '@/app/loading';
import useAffiliationAuthMutation from '@/components/hooks/mutation-hooks/use-affiliation-auth';
import { Button } from '@/components/ui/button';
import { PlayerModel } from '@/server/zod/players';
import { UserCheck2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { FC } from 'react';

export const AffiliateButton: FC<{ player: PlayerModel }> = ({ player }) => {
  const t = useTranslations('Player');
  const { mutate, isPending } = useAffiliationAuthMutation();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={() =>
        mutate(
          { clubId: player.clubId, playerId: player.id },
          {
            onSuccess: () => {
              router.refresh();
            },
          },
        )
      }
      disabled={isPending}
    >
      {isPending ? <LoadingSpinner /> : <UserCheck2 />}
      {t('claim')}
    </Button>
  );
};
