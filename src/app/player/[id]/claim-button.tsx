'use client';

import { LoadingSpinner } from '@/app/loading';
import CancelClaimPlayer from '@/app/player/[id]/cancel-claim-button';
import FormattedMessage, {
  IntlMessageId,
} from '@/components/formatted-message';
import useAffiliationRequestMutation from '@/components/hooks/mutation-hooks/use-affiliation-request';
import useUserClubAffiliations from '@/components/hooks/query-hooks/use-user-affiliations';
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
import { Check, Pointer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { FC, useState } from 'react';

const ClaimPlayer: FC<{
  userId: string;
  clubId: string;
}> = ({ userId, clubId }) => {
  const { id } = useParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useAffiliationRequestMutation();
  const handleClick = () => {
    setOpen(false);
    mutate({ playerId: id, userId, clubId });
  };
  const t = useTranslations();

  const { data: userAffiliation } = useUserClubAffiliations(clubId);

  const hasClaimed =
    userAffiliation &&
    userAffiliation.status === 'requested_by_user' &&
    id === userAffiliation.player.id;

  if (hasClaimed)
    return (
      <CancelClaimPlayer
        userId={userId}
        clubId={clubId}
        affiliationId={userAffiliation.id}
        playerId={userAffiliation.player.id}
      />
    );

  if (!userAffiliation)
    return (
      <Root open={open} onOpenChange={setOpen}>
        <Trigger asChild>
          <ClaimActionButton
            disabled={isPending}
            icon={isPending ? LoadingSpinner : Pointer}
            messageId="Player.claim"
          />
        </Trigger>
        <Content>
          <Header>
            <Title>
              <FormattedMessage id="Player.claim" />
            </Title>
            <Description>
              <FormattedMessage id="Player.claim confirmation" />
            </Description>
          </Header>
          <Button
            className="w-full"
            onClick={handleClick}
            disabled={isPending}
            type="submit"
          >
            {isPending ? <LoadingSpinner /> : <Check />}
            {t('Common.send')}
          </Button>
          <Close asChild>
            <Button className="w-full" variant="outline">
              {t('Common.cancel')}
            </Button>
          </Close>
        </Content>
      </Root>
    );
};

export const ClaimActionButton: FC<ClaimActionButtonProps> = ({
  messageId,
  icon: Icon,
  disabled,
  ...props
}) => (
  <Button
    variant="outline"
    className="flex gap-2 text-nowrap"
    disabled={disabled}
    {...props}
  >
    <Icon />
    <span className="text-xs">
      <FormattedMessage id={messageId} />
    </span>
  </Button>
);

export const IconOnlyButton: FC<
  {
    icon: FC;
    disabled?: boolean;
    title?: string;
  } & React.ComponentProps<'button'>
> = ({ icon: Icon, disabled, title, ...props }) => (
  <Button
    variant="outline"
    className="size-9"
    size="icon"
    disabled={disabled}
    title={title}
    {...props}
  >
    <Icon />
  </Button>
);

type ClaimActionButtonProps = {
  messageId: IntlMessageId;
  icon: FC;
} & React.ComponentProps<'button'>;

export default ClaimPlayer;
