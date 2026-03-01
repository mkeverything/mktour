'use client';

import { useSignOutMutation } from '@/components/hooks/mutation-hooks/use-sign-out';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import { useUserNotificationsCounter } from '@/components/hooks/query-hooks/use-user-notifications';
import LocaleSwitcher from '@/components/locale-switcher';
import ModeToggler from '@/components/navigation/mode-toggler';
import Badge, { BadgeWithCount } from '@/components/ui-custom/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { User2 } from 'lucide-react';
import { MessageKeys, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FC, PropsWithChildren } from 'react';
import LichessLogo from '../ui-custom/lichess-logo';
import { Button } from '../ui/button';

export default function AuthButton() {
  const t = useTranslations('Menu');
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: user, isLoading } = useAuth();
  const { mutate: signOut } = useSignOutMutation(queryClient);
  const { data: notificationsCounter } = useUserNotificationsCounter();

  if (isLoading)
    return <Skeleton className="p-mk my-auto hidden h-4 w-24 sm:block" />;

  if (!user) {
    return (
      <div className="flex items-center">
        <Button className={`flex-row gap-2 p-2`} variant="ghost" asChild>
          <Link href="/login/lichess" prefetch={false}>
            <LichessLogo />
            <span className="hidden sm:block">{t('Profile.login')}</span>
          </Link>
        </Button>
        <LocaleSwitcher />
        <ModeToggler />
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 p-3 select-none">
            <div className="gap-mk relative flex w-fit items-center">
              <User2 size={20} />
              <div className="hidden sm:block">{user.username}</div>
              {!!notificationsCounter && <Badge />}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {menuItems.map(({ path, title }) => (
            <Link href={path} key={title}>
              <StyledItem className="w-full">
                <div className="relative">{t(`Subs.${title}`)}</div>
                {title === 'notifications' && !!notificationsCounter && (
                  <BadgeWithCount count={notificationsCounter} />
                )}
              </StyledItem>
            </Link>
          ))}
          <StyledItem
            onClick={() => {
              signOut(undefined, {
                onSuccess: () => {
                  router.refresh();
                },
              });
            }}
          >
            {t('Profile.logout')}
          </StyledItem>
          <div className="p-mk mx-mk mt-mk flex items-center justify-evenly border-t">
            <LocaleSwitcher />
            <ModeToggler />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

const StyledItem: FC<
  PropsWithChildren & { className?: string; onClick?: () => void }
> = ({ children, className, onClick }) => (
  <DropdownMenuItem
    className={`flex w-full justify-start text-base ${className}`}
    onClick={onClick}
  >
    {children}
  </DropdownMenuItem>
);

const menuItems: MenuItems = [
  {
    title: 'profile',
    path: '/user',
  },
  {
    title: 'notifications',
    path: '/notifications',
  },
  {
    title: 'settings',
    path: '/profile/settings',
  },
];

type MenuItems = {
  title: MessageKeys<
    IntlMessages['Menu']['Subs'],
    keyof IntlMessages['Menu']['Subs']
  >;
  path: string;
}[];
