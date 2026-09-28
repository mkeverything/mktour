'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Wrench } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { PropsWithChildren, useSyncExternalStore } from 'react';

const subscribe = () => () => {};

export default function MaintenanceCard({ children }: PropsWithChildren) {
  const t = useTranslations('Maintenance');

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center gap-2">
        <Wrench className="size-6" />
        <h1 className="text-lg font-semibold">{t('title')}</h1>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p>{t('description')}</p>
        {children}
      </CardContent>
      <CardFooter>
        <Button onClick={() => window.location.reload()} variant="outline">
          {t('reload')}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ExpectedBack({ endsAt }: { endsAt: Date }) {
  const t = useTranslations('Maintenance');
  const format = useFormatter();
  // the server time zone differs from the viewer's, so the end time renders on the client only
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (!isClient) return null;

  return (
    <p className="text-muted-foreground">
      {t('expectedBack', {
        time: format.dateTime(endsAt, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      })}
    </p>
  );
}
