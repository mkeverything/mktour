'use client';

import { turboPascal } from '@/app/fonts';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function MktourNavbar() {
  const t = useTranslations('Menu');
  return (
    <Link href="/" className="group">
      <div
        className={`${turboPascal.className} m-auto text-2xl font-bold select-none`}
      >
        <span>
          {t('mktour')}
          <span className="group-hover:animate-logo-pulse">_</span>
        </span>
      </div>
    </Link>
  );
}
