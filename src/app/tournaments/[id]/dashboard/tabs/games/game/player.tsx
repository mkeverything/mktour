import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FC } from 'react';

const Player: FC<PlayerProps> = ({
  handleMutate,
  isWinner,
  nickname,
  selected,
  position,
}) => (
  <Button
    variant="ghost"
    className={cn(
      `text-2xs ${selected ? 'col-span-1' : 'col-span-2'} line-clamp-2 h-full w-full xl:text-xs ${!selected && position.text} w-full rounded-sm p-0 select-none ${selected && isWinner && 'mk-link'}`,
    )}
    onClick={handleMutate}
  >
    <span className="text-wrap wrap-break-word">{nickname}</span>
  </Button>
);

type PlayerProps = {
  handleMutate?: () => void;
  nickname: string | null;
  isWinner: boolean;
  selected: boolean;
  muted?: boolean;
  position: {
    justify: 'justify-self-start' | 'justify-self-end';
    text: 'text-left' | 'text-right';
  };
};

export default Player;
