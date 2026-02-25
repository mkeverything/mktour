'use client';

import { LoadingSpinner } from '@/app/loading';
import { IconOnlyButton } from '@/app/player/[id]/claim-button';
import FormattedMessage from '@/components/formatted-message';
import { useAffiliationCancelByClubMutation } from '@/components/hooks/mutation-hooks/use-affiliation-cancel';
import {
  Close,
  Content,
  Description,
  Header,
  Root,
  Title,
  Trigger,
} from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { UserX2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { FC, useState } from 'react';

const CancelAffiliationByClub: FC<{
  playerId: string;
  clubId: string;
  isOwnPlayer?: boolean;
}> = ({ playerId, clubId, isOwnPlayer }) => {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useAffiliationCancelByClubMutation();
  const router = useRouter();
  const handleClick = () => {
    mutate(
      {
        playerId,
        clubId,
        skipNotification: isOwnPlayer,
      },
      {
        onSuccess: () => {
          setOpen(false);
          router.refresh();
        },
      },
    );
  };
  const t = useTranslations();

  if (isOwnPlayer) {
    return (
      <IconOnlyButton
        disabled={isPending}
        icon={isPending ? LoadingSpinner : UserX2}
        title={t('Player.cancel affiliation')}
        onClick={handleClick}
      />
    );
  }

  return (
    <Root open={open} onOpenChange={setOpen}>
      <Trigger asChild>
        <IconOnlyButton
          disabled={isPending}
          icon={isPending ? LoadingSpinner : UserX2}
          title={t('Player.cancel affiliation')}
        />
      </Trigger>
      <Content>
        <Header>
          <Title>
            <FormattedMessage id="Common.confirm" />
          </Title>
          <Description>
            <FormattedMessage id="Player.cancel affiliation by club description" />
          </Description>
        </Header>
        <Button
          className="w-full"
          variant="destructive"
          onClick={handleClick}
          disabled={isPending}
          type="submit"
        >
          {isPending ? <LoadingSpinner /> : <UserX2 />}
          {t('Player.cancel affiliation')}
        </Button>
        <Close asChild>
          <Button className="w-full" variant="outline">
            {t('Common.close')}
          </Button>
        </Close>
      </Content>
    </Root>
  );
};

export default CancelAffiliationByClub;
