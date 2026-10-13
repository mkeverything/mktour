import { selected } from '@/components/navigation/mobile/menu';
import MenuItem from '@/components/navigation/mobile/menu-item';
import {
  NavbarItem,
  useIsActivePath,
} from '@/components/navigation/nav-menu-items';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

const MenuItemWithSubMenu: React.FC<MenuItemWithSubMenuProps> = ({
  item,
  toggleOpen,
}) => {
  const isActivePath = useIsActivePath();
  const t = useTranslations('Menu');

  return (
    <>
      <MenuItem>
        <Link
          className={`flex text-2xl ${cn(isActivePath(item.path) ? selected : 'ml-3')}`}
          onClick={() => toggleOpen()}
          href={item.path}
        >
          <div className="flex w-full flex-row items-center justify-between">
            {t(`Subheadings.${item.title}`)}
          </div>
        </Link>
      </MenuItem>
      <div className="mt-2 ml-6 flex flex-col space-y-2">
        {item.subMenuItems?.map((subItem, subIdx: number) => {
          return (
            <MenuItem key={subIdx}>
              <Link
                href={subItem.path}
                onClick={() => toggleOpen()}
                className={` ${isActivePath(subItem.path) ? selected : 'ml-3'}`}
              >
                {t(`Subs.${subItem.title}`)}
              </Link>
            </MenuItem>
          );
        })}
      </div>
    </>
  );
};

type MenuItemWithSubMenuProps = {
  item: NavbarItem;
  toggleOpen: () => void;
};

export default MenuItemWithSubMenu;
