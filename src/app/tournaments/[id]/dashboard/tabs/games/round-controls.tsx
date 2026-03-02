import { Button } from '@/components/ui/button';
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
    <div
      className={`px-mk bg-background/50 sticky top-0 z-10 grid h-10 w-full grid-cols-3 items-center justify-between p-1 backdrop-blur-md`}
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
