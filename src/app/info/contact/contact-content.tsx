'use client';

import Center from '@/components/center';
import LichessSVG from '@/components/icons/lichess-svg';
import GithubLogo, { LogoProps } from '@/components/ui-custom/github-logo';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { FC } from 'react';

export default function ContactContent() {
  const { theme } = useTheme();

  return (
    <Center className="pt-8">
      <div className="flex min-w-fit gap-8">
        {Object.values(links).map((link) => (
          <LinkItem key={link.url} link={link} theme={theme || 'dark'} />
        ))}
      </div>
    </Center>
  );
}

const LinkItem: FC<{
  link: (typeof links)[number];
  theme: string;
}> = ({ link, theme }) => {
  return (
    <Link href={link.url} target="_blank" className="flex items-center gap-3">
      <link.logo size="32" theme={theme} />
      <h1 className="text-2xl">{link.title}</h1>
    </Link>
  );
};

const links: Record<
  string,
  { title: string; logo: FC<LogoProps>; url: string }
> = {
  lichess: {
    title: 'lichess',
    logo: LichessSVG,
    url: 'https://lichess.org/team/mktour',
  },
  github: {
    title: 'github',
    logo: GithubLogo,
    url: 'https://github.com/mkeverything/mktour',
  },
};
