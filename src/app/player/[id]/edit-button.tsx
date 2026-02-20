'use client';

import EditPlayerForm from '@/app/player/[id]/player-form';
import {
  Content,
  Description,
  Header,
  Root,
  Title,
  Trigger,
} from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { StatusInClub } from '@/server/db/zod/enums';
import { PlayerModel } from '@/server/db/zod/players';
import { Pencil } from 'lucide-react';
import { FC, useState } from 'react';

const EditButton: FC<{
  player: PlayerModel;
  status: StatusInClub | null;
}> = ({ player, status }) => {
  const [open, setOpen] = useState(false);
  return (
    <Root open={open} onOpenChange={setOpen}>
      <Trigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil />
        </Button>
      </Trigger>
      <Content>
        <Header>
          <Title className="pl-3">
            {/* <FormattedMessage id="Common.edit" /> */}
          </Title>
          <Description hidden />
        </Header>
        <EditPlayerForm
          {...{ player, clubId: player.clubId, status, setOpen }}
        />
      </Content>
    </Root>
  );
};

export default EditButton;
