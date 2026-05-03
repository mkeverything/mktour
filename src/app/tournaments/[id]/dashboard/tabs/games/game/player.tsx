import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';
import { FC } from 'react';

const Player: FC<PlayerProps> = ({
  canSort,
  dragHandleRef,
  handleMutate,
  isEmpty,
  isWinner,
  nickname,
  selected,
  position,
  className,
  playerRef,
}) => (
  <Button
    ref={playerRef}
    variant="ghost"
    className={cn(
      `text-2xs ${selected ? 'col-span-1' : 'col-span-2'} h-full w-full lg:text-xs ${!selected && position.text} rounded-sm p-0 select-none ${selected && isWinner && 'mk-link'} ${className}`,
    )}
    onClick={handleMutate}
  >
    <span
      className={cn(
        'flex min-w-0 items-center gap-1',
        position.justify,
        isEmpty && 'opacity-0',
      )}
    >
      {canSort && (
        <span
          ref={dragHandleRef}
          className="text-muted-foreground hover:text-foreground inline-flex h-full shrink-0 items-center justify-center px-1 hover:cursor-grab active:cursor-grabbing"
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="size-3.5" />
        </span>
      )}
      <span className="truncate">{nickname}</span>
    </span>
  </Button>
);

type PlayerProps = {
  canSort?: boolean;
  dragHandleRef?: React.Ref<HTMLSpanElement>;
  handleMutate?: () => void;
  isEmpty?: boolean;
  nickname: string | null;
  isWinner: boolean;
  selected: boolean;
  muted?: boolean;
  position: {
    justify: 'justify-self-start' | 'justify-self-end';
    text: 'text-left' | 'text-right';
  };
  className?: string;
  playerRef?: React.Ref<HTMLButtonElement>;
};

export default Player;
