import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { FC, PropsWithChildren, ReactNode, Ref } from 'react';

/** a part of a column, headed the way the club page heads its panels */
const Section: FC<
  PropsWithChildren<{
    title: ReactNode;
    isMock?: boolean;
    className?: string;
    ref?: Ref<HTMLElement>;
  }>
> = ({ title, isMock, className, ref, children }) => {
  const t = useTranslations('Player.Page');
  return (
    <section ref={ref} className={cn('flex min-w-0 flex-col gap-2', className)}>
      <h2 className="flex h-9 shrink-0 items-center gap-1.5 text-sm font-medium">
        {title}
        {isMock && (
          <span className="text-muted-foreground ml-auto rounded-sm border border-dashed px-1.5 text-xs font-normal">
            {t('mock')}
          </span>
        )}
      </h2>
      {children}
    </section>
  );
};

export default Section;
