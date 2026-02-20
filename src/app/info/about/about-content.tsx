'use client';

import Center from '@/components/center';
import LichessSVG from '@/components/icons/lichess-svg';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type ChangeItem, type ChangelogVersion } from '@/lib/changelog';
import { MailIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

interface AboutContentProps {
  changelog: ChangelogVersion[];
}

export default function AboutContent({ changelog }: AboutContentProps) {
  const t = useTranslations('About');
  const format = useFormatter();

  return (
    <Center className="pt-8">
      <div className="max-w-4xl space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{t('title')}</CardTitle>
            <CardDescription className="text-lg">
              {t('description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t('intro')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t('Changelog.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {changelog.map((v) => (
              <div key={v.version} className="group relative">
                <div className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-lg font-bold tracking-tight">
                      {v.version}
                    </h3>
                    <span className="text-muted-foreground text-xs tracking-wider uppercase">
                      {format.dateTime(new Date(v.date), {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <ul className="space-y-4 text-sm">
                    {(
                      Object.entries(v.categories) as [string, ChangeItem[]][]
                    ).map(
                      ([category, changes]) =>
                        changes.length > 0 && (
                          <li key={category} className="space-y-2">
                            <h4 className="text-primary/70 text-xs font-semibold tracking-wider uppercase">
                              {t(`Changelog.${category}`)}
                            </h4>
                            <ul className="text-muted-foreground/80 space-y-1.5">
                              {changes.map((change, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="text-primary/50 pt-1.5 leading-none">
                                    •
                                  </span>
                                  <span>
                                    {change.description}&nbsp;
                                    {change.commitHash && change.commitUrl && (
                                      <Link
                                        href={change.commitUrl}
                                        target="_blank"
                                        className="text-primary/50 hover:text-primary text-xs transition-colors"
                                      >
                                        (#
                                        {change.commitHash})
                                      </Link>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ),
                    )}
                  </ul>
                </div>
              </div>
            ))}
            <div className="border-t pt-2">
              <Link
                href="https://github.com/mkeverything/mktour/blob/main/CHANGELOG.md"
                target="_blank"
                className="text-primary hover:text-primary/80 flex items-center gap-1.5 text-sm font-medium transition-colors"
                rel="noopener noreferrer"
              >
                {t('Changelog.see more')}
                <span className="text-xs">↗</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('contact.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <Link
                href="https://lichess.org/team/mktour"
                target="_blank"
                className="flex items-center gap-3"
              >
                <div className="flex h-6 w-6 items-center">
                  <LichessSVG />
                </div>
                <div>
                  <p className="font-medium">{t('contact.lichess')}</p>
                  <p className="text-muted-foreground text-sm">
                    {t('contact.lichess_desc')}
                  </p>
                </div>
              </Link>
              <Link
                href="mailto:mkcode.org@gmail.com"
                target="_blank"
                className="flex items-center gap-3"
              >
                <MailIcon size="24" />
                <div>
                  <p className="font-medium">{t('contact.email')}</p>
                  <p className="text-muted-foreground text-sm">
                    {t('contact.email_desc')}
                  </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Center>
  );
}
