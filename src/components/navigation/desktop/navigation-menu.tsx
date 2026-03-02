import {
  NAVMENU_ITEMS,
  SubNavItem,
} from '@/components/navigation/nav-menu-items';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

export default function NavigationMenuContainer() {
  const pathname = usePathname();
  const t = useTranslations('Menu');

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {NAVMENU_ITEMS.map((tab) => {
          return (
            <NavigationMenuItem key={tab.path}>
              <NavigationMenuTrigger
                className={
                  pathname.includes(tab.path.split('/')[1]) ? 'font-bold' : ''
                }
              >
                {t(tab.title)}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-6 md:w-sm lg:w-md lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-3 cursor-pointer">
                    <Link
                      className="from-muted/50 to-muted flex w-full flex-col gap-2 rounded-md bg-linear-to-b p-4 px-6 no-underline outline-hidden select-none focus:shadow-md"
                      href={tab.path}
                    >
                      <div className="text-lg font-medium">
                        {t(`Subheadings.${tab.title}`)}
                      </div>
                      <p className="text-muted-foreground text-sm leading-tight">
                        {t(`Descriptions.${tab.title}`)}
                      </p>
                    </Link>
                  </li>
                  {tab.subMenuItems &&
                    tab.subMenuItems.map((subTab: SubNavItem) => (
                      <ListItem
                        key={subTab.path}
                        href={subTab.path}
                        title={t(`Subs.${subTab.title}`)}
                      >
                        {subTab.description &&
                          t(`Subs.Descriptions.${subTab.title}`)}
                      </ListItem>
                    ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'>
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          ref={ref}
          className={cn(
            'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground block space-y-1 rounded-md p-3 leading-none no-underline outline-hidden transition-colors select-none',
            className,
          )}
          {...props}
          href={String(props.href)}
        >
          <div className="text-sm leading-none font-medium">{title}</div>
          <p className="text-muted-foreground text-sm leading-snug">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = 'ListItem';
