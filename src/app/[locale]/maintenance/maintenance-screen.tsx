'use client';

import { turboPascal } from '@/app/fonts';
import '@/styles/cursor.css';
import { useTranslations } from 'next-intl';
import { PropsWithChildren, useSyncExternalStore } from 'react';
import { TypeAnimation } from 'react-type-animation';

const subscribeToSeconds = (callback: () => void) => {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
};
const getSecond = () => Math.floor(Date.now() / 1000);
const getServerSecond = () => null;

export default function MaintenanceScreen({ children }: PropsWithChildren) {
  const t = useTranslations('Maintenance');

  return (
    <main
      className={`${turboPascal.className} flex min-h-dvh items-center justify-center p-4`}
    >
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{t('error')}</h1>
          <TypeAnimation
            sequence={[
              t('status'),
              400,
              (el) => el?.classList.add('cursor-animation'),
            ]}
            wrapper="h2"
            cursor={false}
            className="custom-cursor text-3xl"
            repeat={0}
          />
        </div>
        <p className="text-muted-foreground">{t('description')}</p>
        {children}
        <button
          onClick={() => window.location.reload()}
          className="hover:text-foreground/70 self-start text-xl underline"
        >
          {t('reload')}
        </button>
      </div>
    </main>
  );
}

export function Countdown({ endsAt }: { endsAt: Date }) {
  const t = useTranslations('Maintenance');
  const now = useSyncExternalStore(
    subscribeToSeconds,
    getSecond,
    getServerSecond,
  );
  const remaining =
    now === null
      ? null
      : Math.max(Math.floor(endsAt.getTime() / 1000) - now, 0);
  if (!remaining) return null;

  const eta = [
    Math.floor(remaining / 3600),
    Math.floor((remaining % 3600) / 60),
    remaining % 60,
  ]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');

  return <p className="text-xl tabular-nums">{t('eta', { time: eta })}</p>;
}
