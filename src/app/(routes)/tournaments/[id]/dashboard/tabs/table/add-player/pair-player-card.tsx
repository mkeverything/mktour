import { cn } from '@/lib/utils';
import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { FC } from 'react';

export type PairPlayerCardPlayer = {
  id: string;
  nickname: string;
  rating?: number | null;
  username?: string | null;
};

type PairPlayerCardProps = {
  label?: string;
  player: PairPlayerCardPlayer | null;
  placeholder?: string;
  onClick?: () => void;
  href?: string;
  className?: string;
};

const PairPlayerCard: FC<PairPlayerCardProps> = ({
  label,
  player,
  placeholder,
  onClick,
  href,
  className,
}) => {
  const cardClassName = cn(
    'w-full rounded-lg border border-dashed p-4 text-left transition',
    (onClick || href) && 'hover:border-primary hover:bg-accent/20',
    className,
  );

  const content = (
    <>
      {label && <p className="text-muted-foreground text-xs">{label}</p>}
      {player ? (
        <div className={cn('mt-1 space-y-0.5', !label && 'mt-0')}>
          <div className="flex items-center justify-between gap-2">
            <p className="line-clamp-1 text-sm font-semibold break-all">
              {player.nickname}
            </p>
            {typeof player.rating === 'number' && (
              <small className="text-muted-foreground text-xs">
                {player.rating}
              </small>
            )}
          </div>
          {player.username && (
            <small className="text-muted-foreground text-2xs flex items-center gap-1">
              <UserRound size={12} />
              <span className="line-clamp-1 break-all">{player.username}</span>
            </small>
          )}
        </div>
      ) : (
        <p className={cn('text-muted-foreground text-sm', label && 'mt-1')}>
          {placeholder}
        </p>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cardClassName} onClick={onClick}>
        {content}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={cn(cardClassName, 'block')} tabIndex={0}>
        {content}
      </Link>
    );
  }

  return <div className={cardClassName}>{content}</div>;
};

export default PairPlayerCard;
