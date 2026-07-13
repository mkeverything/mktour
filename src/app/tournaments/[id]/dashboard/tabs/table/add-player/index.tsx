import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import AddDoublesUnit from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-doubles-unit';
import AddUnitDrawerContent from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-unit-drawer-content';
import Fab from '@/components/fab';
import FormattedMessage from '@/components/formatted-message';
import { useTournamentPreStartLocked } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-tournament-pre-start-locked';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import SideDrawer from '@/components/ui-custom/side-drawer';
import { Button } from '@/components/ui/button';
import { UserPlus, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Dispatch, SetStateAction, useContext, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

const AddUnitDrawer = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [addingNewPlayer, setAddingNewPlayer] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { status } = useContext(DashboardContext);
  const { isDesktop } = useContext(MediaQueryContext);
  const preStartLocked = useTournamentPreStartLocked(tournamentId);

  useHotkeys(
    'shift+equal',
    (e) => {
      e.preventDefault();
      if (!preStartLocked) setOpen((prev) => !prev);
    },
    { enableOnFormTags: true },
  );
  useHotkeys(
    'control+shift+equal',
    (e) => {
      e.preventDefault();
      if (preStartLocked) return;
      setOpen((prev) => !prev);
      setAddingNewPlayer(true);
    },
    { enableOnFormTags: true },
  );

  const handleChange = (state: boolean) => {
    if (!isAnimating && (!preStartLocked || !state)) {
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
      disabled={preStartLocked}
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
      disabled={preStartLocked}
      onClick={() => handleChange(!open)}
      icon={open ? X : UserPlus}
      safeArea
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
          <AddDoublesUnit handleClose={() => handleChange(false)} />
        ) : (
          <AddUnitDrawerContent
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

export default AddUnitDrawer;
