'use client';

import EditPlayerForm from '@/app/[locale]/(routes)/player/[id]/player-form';
import {
  Content,
  Description,
  Header,
  Root,
  Title,
  Trigger,
} from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { StatusInClub } from '@/server/zod/enums';
import { PlayerEditModel, PlayerModel } from '@/server/zod/players';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, useState } from 'react';

const EditButton: FC<{
  player: Pick<PlayerModel, 'clubId'> & PlayerEditModel;
  status: StatusInClub | null;
  canEditRealname?: boolean;
}> = ({ player, status, canEditRealname = true }) => {
  const t = useTranslations('Common');
  const [open, setOpen] = useState(false);
  return (
    <Root open={open} onOpenChange={setOpen}>
      <Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('edit')}>
          <Pencil />
        </Button>
      </Trigger>
      <Content>
        <Header>
          <Title />
          <Description />
        </Header>
        <EditPlayerForm
          {...{
            player,
            clubId: player.clubId,
            status,
            setOpen,
            canEditRealname,
          }}
        />
      </Content>
    </Root>
  );
};

export default EditButton;
