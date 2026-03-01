import { TournamentAuthStatus } from '@/server/db/zod/enums';
import { FC, PropsWithChildren, ReactNode } from 'react';

const FabProvider: FC<FabProviderProps> = ({
  status,
  fabContent,
  scrolling,
}) => {
  if (status !== 'organizer') return null;

  return (
    <div
      className={`${scrolling && 'opacity-50'} relative z-10 transition-all duration-300 ease-linear`}
    >
      {fabContent}
    </div>
  );
};

type FabProviderProps = PropsWithChildren & {
  status: TournamentAuthStatus;
  fabContent: ReactNode;
  scrolling?: boolean;
};

export default FabProvider;
