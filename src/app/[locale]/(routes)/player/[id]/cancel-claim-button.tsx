'use client';

import { LoadingSpinner } from '@/app/[locale]/(routes)/loading';
import { ClaimActionButton } from '@/app/[locale]/(routes)/player/[id]/claim-button';
import FormattedMessage from '@/components/formatted-message';
import useAffiliationAbortRequestMutation from '@/components/hooks/mutation-hooks/use-affiliation-abort-request';
import {
  Close,
  Content,
  Header,
  Root,
  Title,
  Trigger,
} from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { PointerOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, useState } from 'react';

const CancelClaimPlayer: FC<{
  userId: string;
  clubId: string;
  affiliationId: string;
  playerId: string;
}> = ({ userId, clubId, affiliationId, playerId }) => {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useAffiliationAbortRequestMutation(clubId);
  const handleClick = () => {
    setOpen(false);
    mutate({
      affiliationId,
      userId,
      playerId,
    });
  };
  const t = useTranslations();

  return (
    <Root open={open} onOpenChange={setOpen}>
      <Trigger asChild>
        <ClaimActionButton
          disabled={isPending}
          icon={isPending ? LoadingSpinner : PointerOff}
          messageId="Player.cancel claim"
        />
      </Trigger>
      <Content>
        <Header>
          <Title>
            <FormattedMessage id="Common.confirm" />
          </Title>
        </Header>
        <Button
          className="w-full"
          variant="destructive"
          onClick={handleClick}
          disabled={isPending}
          type="submit"
        >
          {isPending ? <LoadingSpinner /> : <PointerOff />}
          {t('Player.cancel claim')}
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

export default CancelClaimPlayer;
