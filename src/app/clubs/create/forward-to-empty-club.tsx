'use client';

import { forwardAction } from '@/app/clubs/create/forward-action';
import RichText from '@/components/rich-text';
import HalfCard from '@/components/ui-custom/half-card';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { ClubModel } from '@/server/db/zod/clubs';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ForwardToEmptyClub({ club }: { club: ClubModel }) {
  const t = useTranslations('Club.New.forward to empty');
  return (
    <div className="mk-container pt-mk-2">
      <HalfCard className="">
        <CardContent className="p-mk md:p-mk-3 md:pt-mk-3 gap-mk-2 flex w-full flex-col">
          <RichText>
            {(tags) =>
              t.rich('message', {
                club: club.name,
                ...tags,
              })
            }
          </RichText>
          <Button
            className="group py-8"
            onClick={async () => await forwardAction({ clubId: club.id })}
          >
            <p>{`${t('button text')} ${club.name}`}</p>
            <ArrowRight className="transition-all duration-200 group-hover:translate-x-0.5" />
          </Button>
        </CardContent>
      </HalfCard>
    </div>
  );
}
