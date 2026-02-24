import { Status } from '@/server/queries/get-status-in-tournament';
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
  status: Status;
  fabContent: ReactNode;
  scrolling?: boolean;
};

export default FabProvider;
