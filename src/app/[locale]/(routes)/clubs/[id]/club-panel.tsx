import FormattedMessage, {
  IntlMessageId,
} from '@/components/formatted-message';
import { useMediaQuery } from '@/components/providers/media-query-provider';
import Paginator from '@/components/ui-custom/paginator';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ComponentProps, FC, PropsWithChildren, useRef, useState } from 'react';

export const Count: FC<{ value?: number }> = ({ value }) => (
  <span className="text-muted-foreground flex items-baseline gap-1.5 font-normal tabular-nums">
    <span aria-hidden>·</span>
    {value}
  </span>
);

// on desktop the search rests as a square icon and grows out of it on focus; on mobile it is always open
export const PanelHeader: FC<{
  messageId: IntlMessageId;
  count?: number;
  search: string;
  setSearch: (_value: string) => void;
}> = ({ messageId, count, search, setSearch }) => {
  const t = useTranslations('Common');
  const [isFocused, setIsFocused] = useState(false);
  const isOpen = isFocused || search.length > 0;

  return (
    // mirrors the scroller's gutter so the search lines up with the list edge
    <div className="small-scrollbar flex shrink-0 items-center gap-4 lg:-my-1 lg:-mr-3 lg:[scrollbar-gutter:stable] lg:overflow-hidden lg:py-1 lg:pr-3">
      <h2 className="flex shrink-0 items-baseline gap-1.5 text-sm font-medium max-lg:sr-only">
        <FormattedMessage id={messageId} />
        <Count value={count} />
      </h2>
      <label
        className={cn(
          'border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-9 min-w-0 flex-1 cursor-text items-center rounded-md border pr-3 shadow-xs transition-[max-width,box-shadow] duration-300 ease-out focus-within:ring-[3px] motion-reduce:transition-none lg:ml-auto',
          isOpen
            ? 'lg:max-w-full'
            : 'lg:hover:bg-accent lg:max-w-9 lg:cursor-pointer',
        )}
      >
        <Search className="text-muted-foreground mx-[9px] size-4 shrink-0" />
        <input
          value={search}
          placeholder={t('search')}
          aria-label={t('search')}
          onChange={(event) => setSearch(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            setSearch('');
            event.currentTarget.blur();
          }}
          className="placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm"
        />
      </label>
    </div>
  );
};

// the scroller is the column itself on desktop and the page on mobile, so pagination looks ahead within it
export const PanelScroller: FC<
  PropsWithChildren<Omit<ComponentProps<typeof Paginator>, 'root'>>
> = ({ children, ...paginator }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const isColumnLayout = useMediaQuery('(min-width: 1024px)', false);

  return (
    <div
      ref={scrollerRef}
      className="small-scrollbar flex flex-col lg:min-h-0 lg:flex-1 lg:[scrollbar-gutter:stable] lg:overflow-y-auto lg:overscroll-contain"
    >
      {children}
      <Paginator
        {...paginator}
        root={isColumnLayout ? scrollerRef : undefined}
      />
    </div>
  );
};
