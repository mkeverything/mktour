'use client';

import { turboPascal } from '@/app/fonts';
import { ReactNode, useEffect, useState } from 'react';

export default function CountdownGate({ children }: CountdownGateProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(RELEASE_DATE));

  useEffect(() => {
    mounted = true;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const updated = getTimeLeft(RELEASE_DATE);
      setTimeLeft(updated);

      if (!updated) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!timeLeft) {
    return <>{children}</>;
  }

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (!mounted) return null;
  return (
    <div
      className={`${turboPascal.className} fixed flex h-screen w-screen items-center justify-center text-4xl`}
    >
      <div className="gap-mk-2 flex">
        <div>{pad(timeLeft.days)}d</div>
        <div>{pad(timeLeft.hours)}h</div>
        <div>{pad(timeLeft.minutes)}m</div>
        <div>{pad(timeLeft.seconds)}s</div>
      </div>
    </div>
  );
}

let mounted = false;

const RELEASE_DATE = new Date(2026, 2, 2, 20); // March 2, 2026 20:00

function getTimeLeft(releaseDate: Date) {
  const now = Date.now();
  const distance = releaseDate.getTime() - now;

  if (distance <= 0) return null;

  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((distance / (1000 * 60)) % 60),
    seconds: Math.floor((distance / 1000) % 60),
  };
}

type CountdownGateProps = {
  children: ReactNode;
};
