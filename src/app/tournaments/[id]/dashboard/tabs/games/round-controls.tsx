import { Dispatch, FC, SetStateAction, useContext } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useHotkeys } from 'react-hotkeys-hook';

import { MockMode } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TournamentModel } from '@/server/zod/tournaments';

const RoundControls: FC<RoundControlProps> = ({
  currentRound,
  roundInView,
  setRoundInView,
  currentTab,
  format,
}) => {
  const t = useTranslations('Tournament.Round');
  const { isDesktop } = useContext(MediaQueryContext);
  const shouldHandleArrows = isDesktop || currentTab === 'games';

  const changeRound = (delta: number) => {
    setRoundInView((prevRound) => {
      const nextRound = prevRound + delta;
      if (nextRound < 1) return 1;
      if (nextRound > currentRound) return currentRound;
      return nextRound;
    });
  };

  useHotkeys(
    'left',
    (event) => {
      if (!shouldHandleArrows || roundInView <= 1) return;
      event.preventDefault();
      changeRound(-1);
    },
    { enabled: shouldHandleArrows, enableOnFormTags: false },
    [shouldHandleArrows, roundInView, currentRound],
  );

  useHotkeys(
    'right',
    (event) => {
      if (!shouldHandleArrows || roundInView >= currentRound) return;
      event.preventDefault();
      changeRound(1);
    },
    { enabled: shouldHandleArrows, enableOnFormTags: false },
    [shouldHandleArrows, roundInView, currentRound],
  );

  if (
    [
      'single_elim',
      'double_elim',
      'single elimination',
      'double elimination',
    ].includes(format)
  )
    return null;

  return (
    <div className="bg-background/50 px-mk-2 sticky top-0 z-10 backdrop-blur-md">
      <div
        className={`m-auto grid h-10 w-full max-w-xl grid-cols-3 items-center justify-between`}
      >
        <Button
          style={{ visibility: roundInView === 1 ? 'hidden' : 'visible' }}
          onClick={() => changeRound(-1)}
          {...buttonProps}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setRoundInView(currentRound)}
          size="sm"
        >
          <span className={roundInView === currentRound ? 'font-bold' : ''}>
            {t('round', { roundInView })}
          </span>
        </Button>
        <Button
          style={{
            visibility: roundInView === currentRound ? 'hidden' : 'visible',
          }}
          onClick={() => changeRound(1)}
          {...buttonProps}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="gap-mk m-auto flex w-full max-w-4xl flex-1 justify-between">
        <Card className="h-mk dark:bg-primary bg-secondary w-full rounded-lg" />
        <Card className="h-mk dark:bg-secondary bg-primary w-full rounded-lg" />
      </div>
    </div>
  );
};

const buttonProps: React.ComponentProps<typeof Button> = {
  variant: 'ghost',
  size: 'sm',
  className: 'w-full',
};

interface RoundControlProps {
  currentRound: number;
  roundInView: number;
  setRoundInView: Dispatch<SetStateAction<number>>;
  currentTab: 'main' | 'games' | 'table';
  format: TournamentModel['format'] | MockMode;
}

export default RoundControls;
