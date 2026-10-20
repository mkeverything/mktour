'use client';

import LichessLogo from '@/components/ui-custom/lichess-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface SignInWithLichessButtonProps {
  className?: string;
  from?: string;
}

export default function SignInWithLichessButton({
  className,
  from,
}: SignInWithLichessButtonProps) {
  const t = useTranslations();
  const [clicked, setClicked] = useState(false);

  return (
    <form
      action={`/login/lichess${from ? '?from=' + encodeURIComponent(from) : ''}`}
      method="post"
      onSubmit={() => setClicked(true)}
      className="contents"
    >
      <Button
        className={cn(
          `m-auto grid h-28 min-h-28 w-full max-w-md flex-none content-center justify-items-center gap-2 px-1 font-bold`,
          className,
        )}
        disabled={clicked}
      >
        <LichessLogo className="size-6 fill-current stroke-current" />
        <span className="self-baseline-last text-xl leading-none font-light md:px-4 md:text-xl">
          {t('Home.sign in with lichess')}
        </span>
      </Button>
    </form>
  );
}
