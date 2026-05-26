'use client';

import { LoadingSpinner } from '@/app/loading';
import FormattedMessage from '@/components/formatted-message';
import useDeletePlayerMutation from '@/components/hooks/mutation-hooks/use-player-delete';
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
import { useQueryClient } from '@tanstack/react-query';
import { CircleX, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { redirect } from 'next/navigation';
import { FC, useState } from 'react';

const DeletePlayer: FC<{ clubId: string; playerId: string }> = ({
  clubId,
  playerId,
}) => {
  const queryClient = useQueryClient();
  const { mutate, isPending, isSuccess } = useDeletePlayerMutation(
    queryClient,
    clubId,
  );
  const handleClick = () => mutate({ playerId });
  const [open, setOpen] = useState(false);
  const t = useTranslations('Common');

  if (isSuccess) redirect('/clubs/my');

  return (
    <Root open={open} onOpenChange={setOpen}>
      <Trigger asChild>
        <Button
          disabled={isPending}
          // size="sm"
          variant="destructive"
          className="gap-mk flex w-full"
        >
          {isPending ? <LoadingSpinner /> : <Trash2Icon />}
          <FormattedMessage id="Player.delete" />
        </Button>
      </Trigger>
      <Content>
        <Header>
          <Title>{t('confirm')}</Title>
          <Description hidden />
        </Header>
        <Button
          variant={'destructive'}
          className="w-full"
          onClick={handleClick}
          disabled={isPending}
        >
          {isPending ? <LoadingSpinner /> : <CircleX />}
          {t('delete')}
        </Button>
        <Close asChild>
          <Button className="w-full" variant="outline">
            {t('cancel')}
          </Button>
        </Close>
      </Content>
    </Root>
  );
};

export default DeletePlayer;
