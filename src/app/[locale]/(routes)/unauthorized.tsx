import SignInWithLichessButton from '@/components/auth/sign-in-with-lichess-button';
import HomeText from '@/components/home-text';
import { Button } from '@/components/ui/button';
import '@/styles/cursor.css';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function Unauthorized() {
  const t = useTranslations('Home');

  return (
    <div className="h-mk-content-height flex w-full flex-col gap-7 p-3.5 md:gap-2 md:pb-8">
      <HomeText />
      <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-3 md:max-w-4xl md:grid-cols-2">
        <SignInWithLichessButton />
        <Button variant="outline" className="h-28 flex-col gap-2" asChild>
          <Link href="/info/about">
            <span className="text-[1.4rem] leading-none font-light md:text-xl">
              {t('learn more')}
            </span>
            <span className="text-muted-foreground text-center text-base font-light text-balance">
              {t('learn more description')}
            </span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
