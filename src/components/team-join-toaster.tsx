'use client';

import { turboPascal } from '@/app/fonts';
import { Button } from '@/components/ui/button';
import { COOKIES } from '@/lib/config/constants';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect } from 'react';
import { toast } from 'sonner';

export default function TeamJoinToaster() {
  const t = useTranslations('TeamJoinToaster');
  const handleCancel = () => {
    toast.success(t('user refused'));
    setTimeout(() => toast.dismiss('teamJoin'));
  };

  const handleJoin = async () => {
    setTimeout(() => toast.dismiss('teamJoin'));
    toast.promise(
      fetch('/api/auth/join-team', {
        method: 'POST',
      }),
      {
        loading: t('adding'),
        error: t('join error'),
        success: t('joined successfuly'),
      },
    );
  };
  setTimeout(() => {
    toast(
      <div>
        <h1
          className={`${turboPascal.className} text-center text-2xl leading-8 font-bold`}
        >
          {t('toast header')}
        </h1>
        <p>
          {t.rich('toast message', {
            lichess: (words) => (
              <Link
                href="https://lichess.org/team/mktour"
                className="font-semibold underline"
              >
                {words}
              </Link>
            ),
          })}
        </p>
        <br />
        <div className="flex flex-col justify-center gap-2">
          <Button onClick={handleJoin}>{t('join team')}</Button>
          <Button variant="secondary" onClick={handleCancel}>
            {t('no join button')}
          </Button>
        </div>
      </div>,
      {
        id: 'teamJoin',
        dismissible: true,
        duration: 150000,
      },
    );
  }, 500);

  useEffect(() => {
    document.cookie = `${COOKIES.NEW_USER_TOAST}=; path=/; max-age=0`;
  }, []);

  return <></>;
}
