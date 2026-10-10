import { FC, PropsWithChildren } from 'react';

const ClubsLayout: FC<PropsWithChildren> = async ({ children }) => (
  <div className="mk-container">{children}</div>
);

export default ClubsLayout;
