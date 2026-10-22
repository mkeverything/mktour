'use client';

import { useDebounce } from '@/components/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FC, useEffect, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

const DiscoverySearch: FC<{
  value?: string;
  onChange: (value: string | null) => void;
  placeholder: string;
  className?: string;
}> = ({ value = '', onChange, placeholder, className }) => {
  const t = useTranslations('Discovery');
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const debounced = useDebounce(draft, SEARCH_DEBOUNCE_MS).trim();

  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value !== draft.trim()) setDraft(value);
  }

  const settled = debounced === draft.trim();
  useEffect(() => {
    if (settled && debounced !== syncedValue) onChange(debounced || null);
  }, [settled, debounced, syncedValue, onChange]);

  return (
    <div className={cn('relative', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          onClick={() => setDraft('')}
          aria-label={t('clear search')}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
};

export default DiscoverySearch;
