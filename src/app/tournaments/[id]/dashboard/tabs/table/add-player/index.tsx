import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import AddPlayerDrawerContent from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-player-drawer-content';
import AddPairTeam from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-pair-team';
import Fab from '@/components/fab';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import SideDrawer from '@/components/ui-custom/side-drawer';
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

  return (
    <>
      <Fab
        container={open || isAnimating ? document.body : undefined}
        className={`${(open || isAnimating) && 'z-60 md:hidden'}`}
        onClick={() => handleChange(!open)}
        icon={open ? X : UserPlus}
      />
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
