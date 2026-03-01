'use client';

import { useAuthSelectClub } from '@/components/hooks/mutation-hooks/use-auth-select-club';
import RichText from '@/components/rich-text';
import HalfCard from '@/components/ui-custom/half-card';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { ClubModel } from '@/server/zod/clubs';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export default function ForwardToEmptyClub({ club }: { club: ClubModel }) {
  const t = useTranslations('Club.New.forward to empty');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useAuthSelectClub(queryClient);
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
            disabled={isPending}
            onClick={async () => {
              await mutateAsync({ clubId: club.id });
              router.push('/clubs/my');
            }}
          >
            <p>{`${t('button text')} ${club.name}`}</p>
            <ArrowRight className="transition-all duration-200 group-hover:translate-x-0.5" />
          </Button>
        </CardContent>
      </HalfCard>
    </div>
  );
}
