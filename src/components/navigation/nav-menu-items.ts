import { MessageKeys } from 'next-intl';

export const NAVMENU_ITEMS: NavbarItem[] = [
  {
    title: 'club',
    topTab: 'dashboard',
    path: '/clubs/my',
    subMenuItems: [
      {
        title: 'all clubs',
        path: '/clubs/all',
        description: true,
      },
      {
        title: 'new club',
        path: '/clubs/create',
        description: true,
      },
    ],
  },
  {
    title: 'tournaments',
    topTab: 'my tournaments',
    path: '/tournaments/my',
    subMenuItems: [
      {
        title: 'all tournaments',
        path: '/tournaments/all',
        userOnly: true,
        description: true,
      },
      {
        title: 'make tournament',
        path: '/tournaments/create',
        description: true,
      },
    ],
  },
  {
    title: 'about us',
    path: '/info/about',
    topTab: 'about',
    subMenuItems: [
      // {
      //   title: 'FAQ',
      //   path: '/info/faq',
      //   description: true,
      // },
      // {
      //   title: 'contact',
      //   path: '/info/contact',
      //   description: true,
      // },
    ],
  },
];

export type NavbarItem = {
  title: MessageKeys<IntlMessages['Menu'], keyof IntlMessages['Menu']>;
  path: string;
  description?: string;
  userOnly?: boolean;
  topTab?: string;
  subMenuItems?: SubNavItem[];
};

export type SubNavItem = {
  title: MessageKeys<
    IntlMessages['Menu']['Subs'],
    keyof IntlMessages['Menu']['Subs']['Descriptions']
  >;
  userOnly?: boolean;
  path: string;
  description: boolean;
};
