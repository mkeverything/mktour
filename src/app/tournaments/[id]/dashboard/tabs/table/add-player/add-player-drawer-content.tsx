import AddFakerPlayer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-fake-player';
import AddNewPlayer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-new-player';
import AddPlayer from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-player';
import { Button } from '@/components/ui/button';
import { PlayerFormModel, PlayerWithUsernameModel } from '@/server/zod/players';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Dispatch, SetStateAction } from 'react';

const AddPlayerDrawerContent = ({
  value,
  setValue,
  addingNewPlayer,
  setAddingNewPlayer,
  handleClose,
  setDrawerOpen,
  onPlayerSelected,
  onPlayerCreated,
  showFakerButton = true,
}: AddPlayerDrawerContentProps) => {
  const t = useTranslations('Tournament.AddPlayer');

  const returnToNewPlayer = (player: PlayerFormModel & { id?: string }) => {
    setAddingNewPlayer(true);
    setValue(player.nickname);
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <Button
          className="flex w-full gap-2"
          onClick={() => setAddingNewPlayer((prev) => !prev)}
          variant={addingNewPlayer ? 'outline' : 'default'}
        >
          {!addingNewPlayer ? <Plus /> : <ArrowLeft />}
          {!addingNewPlayer ? t('add new player') : t('back')}{' '}
        </Button>
        {showFakerButton &&
          process.env.NODE_ENV !== 'production' &&
          setDrawerOpen && <AddFakerPlayer setOpen={setDrawerOpen} />}
      </div>

      {addingNewPlayer ? (
        <AddNewPlayer
          value={value}
          setValue={setValue}
          returnToNewPlayer={returnToNewPlayer}
          handleClose={handleClose}
          onPlayerCreated={onPlayerCreated}
        />
      ) : (
        <AddPlayer
          value={value}
          setValue={setValue}
          handleClose={handleClose}
          onPlayerSelected={onPlayerSelected}
        />
      )}
    </>
  );
};

type AddPlayerDrawerContentProps = {
  value: string;
  setValue: Dispatch<SetStateAction<string>>;
  addingNewPlayer: boolean;
  setAddingNewPlayer: Dispatch<SetStateAction<boolean>>;
  handleClose: () => void;
  setDrawerOpen?: (_state: boolean) => void;
  onPlayerSelected?: (_player: PlayerWithUsernameModel) => void;
  onPlayerCreated?: (_player: PlayerWithUsernameModel) => void;
  showFakerButton?: boolean;
};

export default AddPlayerDrawerContent;
