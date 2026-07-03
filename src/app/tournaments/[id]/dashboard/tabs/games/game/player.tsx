import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FC } from 'react';

const Player: FC<PlayerProps> = ({
  handleMutate,
  isWinner,
  nickname,
  selected,
  className,
}) => (
  <Button
    variant="ghost"
    className={cn(
      'px-mk h-auto min-h-9 w-full justify-start rounded-sm p-0 text-sm select-none lg:text-base',
      selected && isWinner && 'mk-link',
      className,
    )}
    onClick={handleMutate}
  >
    <span className="truncate">{nickname}</span>
  </Button>
);

type PlayerProps = {
  handleMutate?: () => void;
  nickname: string | null;
  isWinner: boolean;
  selected: boolean;
  className?: string;
};

export default Player;
