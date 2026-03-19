import FormattedMessage from '@/components/formatted-message';
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
import { PlayerTournamentModel } from '@/server/zod/players';
import { LogOut, Trash2 } from 'lucide-react';
import { FC } from 'react';

export const DeleteButton: FC<{ handleDelete: () => void }> = ({
  handleDelete,
}) => (
  <Button
    className="flex gap-2"
    size="lg"
    variant="destructive"
    onClick={handleDelete}
  >
    <Trash2 />
    <FormattedMessage id="Tournament.Table.Player.delete" />
  </Button>
);

export const WithdrawButtonWithConfirmation: FC<{
  selectedPlayer: PlayerTournamentModel;
  handleWithdraw: () => void;
}> = ({ selectedPlayer, handleWithdraw }) => (
  <Root>
    <Trigger asChild>
      <Button className="flex gap-2" size="lg" variant="outline">
        <LogOut />
        <FormattedMessage id="Tournament.Table.Player.Withdraw.withdraw" />
      </Button>
    </Trigger>
    <Content>
      <Header>
        <Title>
          <FormattedMessage id="Tournament.Main.confirmation header" />
        </Title>
        <Description>
          <FormattedMessage id="Tournament.Table.Player.Withdraw.description" />
        </Description>
      </Header>
      <Button
        className="flex w-full gap-2"
        size="lg"
        onClick={handleWithdraw}
        variant="destructive"
      >
        <LogOut />
        <FormattedMessage
          id="Tournament.Table.Player.Withdraw.confirm"
          values={{ nickname: selectedPlayer.nickname }}
        />
      </Button>
      <Close asChild>
        <Button size="lg" className="w-full" variant="outline">
          <FormattedMessage id="Common.close" />
        </Button>
      </Close>
    </Content>
  </Root>
);
