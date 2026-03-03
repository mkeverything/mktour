import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dispatch, FC, SetStateAction } from 'react';

const RoundControls: FC<RoundControlProps> = ({
  currentRound,
  roundInView,
  setRoundInView,
}) => {
  const t = useTranslations('Tournament.Round');

  const handleClick = (direction: string) => {
    let newRoundInView = roundInView;
    if (direction === '<') {
      newRoundInView = roundInView - 1;
    } else if (direction === '>') {
      newRoundInView = roundInView + 1;
    }
    setRoundInView(newRoundInView);
  };

  return (
    <div className="bg-background/50 px-mk-2 sticky top-0 z-10 backdrop-blur-md">
      <div
        className={`m-auto grid h-10 w-full max-w-xl grid-cols-3 items-center justify-between`}
      >
        <Button
          style={{ visibility: roundInView === 1 ? 'hidden' : 'visible' }}
          onClick={() => handleClick('<')}
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
          onClick={() => handleClick('>')}
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
}

export default RoundControls;
