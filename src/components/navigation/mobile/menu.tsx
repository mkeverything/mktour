import { useSignOutMutation } from '@/components/hooks/mutation-hooks/use-sign-out';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import LocaleSwitcher from '@/components/locale-switcher';
import MenuItem from '@/components/navigation/mobile/menu-item';
import MenuItemWithSubMenu from '@/components/navigation/mobile/menu-item-with-sub';
import MenuToggle from '@/components/navigation/mobile/menu-toggle';
import ModeToggler from '@/components/navigation/mode-toggler';
import { NAVMENU_ITEMS } from '@/components/navigation/nav-menu-items';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useQueryClient } from '@tanstack/react-query';
import { motion, StyleTransitions, useCycle, Variants } from 'framer-motion';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FC, RefObject, useEffect, useMemo, useRef, useState } from 'react';

const Menu: FC = () => {
  const containerRef = useRef(null);
  const router = useRouter();
  const { data: user } = useAuth();
  const queryClient = useQueryClient();
  const { mutate: signOut } = useSignOutMutation(queryClient);
  const { height } = useDimensions(containerRef);
  const [isOpen, toggleOpen] = useCycle(false, true);
  const pathname = usePathname();
  const handleSignOut = async () => {
    signOut(undefined, {
      onSuccess: () => {
        toggleOpen();
        router.refresh();
      },
    });
  };

  const variants = useMemo<Variants>(
    () => ({
      open: {
        transition: { staggerChildren: 0.02, delayChildren: 0.15 },
      },
      closed: {
        transition: { staggerChildren: 0.01, staggerDirection: -1 },
      },
    }),
    [],
  );

  const sidebar = useMemo(
    (): Variants => ({
      open: (height = 1000) => ({
        clipPath: `circle(${height * 2 + 200}px at 100% 0)`,
        transition: {
          type: 'spring',
          stiffness: 20,
          restDelta: 2,
        } as StyleTransitions,
      }),
      closed: {
        clipPath: 'circle(0px at 100% 0)',
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 40,
        } as StyleTransitions,
      },
    }),
    [],
  );

  const t = useTranslations('Menu');

  return (
    <div className="w-8">
      <motion.nav
        initial={false}
        animate={isOpen ? 'open' : 'closed'}
        custom={height}
        className={`fixed inset-0 z-100 block w-full ${isOpen ? '' : 'pointer-events-none'}`}
        ref={containerRef}
      >
        <motion.div
          className="bg-card absolute inset-0 right-0 w-full"
          variants={sidebar}
        />
        <motion.ul variants={variants}>
          <ScrollArea
            className="offset-4 grid h-[92svh] w-full gap-2 px-8 pt-8 pb-4"
            type="auto"
          >
            {NAVMENU_ITEMS.map((item, idx) => (
              <div key={idx}>
                {!item.subMenuItems ? (
                  <MenuItem key={idx}>
                    <Link
                      href={item.path}
                      onClick={() => toggleOpen()}
                      className={`text-2xl ${
                        pathname.includes(item.path.replaceAll('/', ''))
                          ? selected
                          : ''
                      }`}
                    >
                      {t(item.title)}
                    </Link>
                  </MenuItem>
                ) : (
                  <MenuItemWithSubMenu toggleOpen={toggleOpen} item={item} />
                )}
                <MenuItem>
                  <Separator className="my-3 h-px" />
                </MenuItem>
              </div>
            ))}
            <MenuItem className="ml-3 text-2xl">
              {!user ? (
                <Link
                  href="/login/lichess"
                  onClick={() => toggleOpen()}
                  prefetch={false}
                >
                  {t('Profile.sign in')}
                </Link>
              ) : (
                <button name="log out" onClick={handleSignOut}>
                  {t('Profile.logout')}
                </button>
              )}
              <div className="my-3 h-px w-full bg-transparent"></div>
            </MenuItem>
          </ScrollArea>
          <MenuItem className="absolute bottom-4 flex w-full items-center justify-center gap-8">
            <LocaleSwitcher />
            <ModeToggler />
          </MenuItem>
        </motion.ul>
        <MenuToggle toggle={toggleOpen} />
      </motion.nav>
    </div>
  );
};

export const selected =
  'py-1 px-3 -ml-0 bg-primary text-primary-foreground w-fit rounded-sm';

const useDimensions = (ref: RefObject<HTMLElement | null>) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (ref.current) {
      setDimensions({
        width: ref.current.offsetWidth,
        height: ref.current.offsetHeight,
      });
    }
  }, [ref]);

  return dimensions;
};

export default Menu;
