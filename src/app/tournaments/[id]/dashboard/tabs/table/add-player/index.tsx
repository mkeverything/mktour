import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import AddPairTeam from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-pair-team';
import AddPlayerDrawerContent from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-player-drawer-content';
import Fab from '@/components/fab';
import FormattedMessage from '@/components/formatted-message';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import SideDrawer from '@/components/ui-custom/side-drawer';
import { Button } from '@/components/ui/button';
import { UserPlus, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Dispatch, SetStateAction, useContext, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

const AddPlayerDrawer = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [addingNewPlayer, setAddingNewPlayer] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { status } = useContext(DashboardContext);
  const { isDesktop } = useContext(MediaQueryContext);

  useHotkeys(
    'shift+equal',
    (e) => {
      e.preventDefault();
      setOpen((prev) => !prev);
    },
    { enableOnFormTags: true },
  );
  useHotkeys(
    'control+shift+equal',
    (e) => {
      e.preventDefault();
      setOpen((prev) => !prev);
      setAddingNewPlayer(true);
    },
    { enableOnFormTags: true },
  );

  const handleChange = (state: boolean) => {
    if (!isAnimating) {
      setOpen(state);
      setAddingNewPlayer(false);
      setValue('');
    }
  };

  const { data: tournamentInfo } = useTournamentInfo(tournamentId);
  const isDoubles = tournamentInfo?.tournament.type === 'doubles';
  if (
    !tournamentInfo ||
    tournamentInfo.tournament.startedAt ||
    status !== 'organizer'
  )
    return null;

  const trigger = isDesktop ? (
    <Button
      variant="outline"
      className="size-10 lg:w-fit"
      onClick={() => handleChange(!open)}
    >
      <UserPlus />
      <div className="hidden lg:block">
        <FormattedMessage id="Tournament.AddPlayer.add player" />
      </div>
    </Button>
  ) : (
    <Fab
      container={open || isAnimating ? document.body : undefined}
      className={`${(open || isAnimating) && 'z-60 md:hidden'}`}
      onClick={() => handleChange(!open)}
      icon={open ? X : UserPlus}
    />
  );

  return (
    <>
      {trigger}
      <SideDrawer
        open={open}
        setOpen={handleChange}
        setIsAnimating={setIsAnimating}
      >
        {isDoubles ? (
          <AddPairTeam handleClose={() => handleChange(false)} />
        ) : (
          <AddPlayerDrawerContent
            value={value}
            setValue={setValue}
            addingNewPlayer={addingNewPlayer}
            setAddingNewPlayer={setAddingNewPlayer}
            handleClose={() => handleChange(false)}
            setDrawerOpen={handleChange}
            showFakerButton
          />
        )}
      </SideDrawer>
    </>
  );
};

export type DrawerProps = {
  value: string;
  handleClose: () => void;
  setValue: Dispatch<SetStateAction<string>>;
};

export default AddPlayerDrawer;
