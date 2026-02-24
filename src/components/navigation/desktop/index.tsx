import AuthButton from '@/components/auth/auth-button';
import NavigationMenuContainer from '@/components/navigation/desktop/navigation-menu';
import GlobalSearch from '@/components/navigation/search';
import { FC } from 'react';

const Desktop: FC = () => {
  return (
    <div className="flex w-full items-center justify-end align-middle">
      <NavigationMenuContainer />
      <GlobalSearch />
      <AuthButton />
    </div>
  );
};

export default Desktop;
