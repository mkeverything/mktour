import { FC } from 'react';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ClassNameValue } from 'tailwind-merge';

const SearchInput: FC<{
  search: string;
  setSearch: (_value: string) => void;
  className?: ClassNameValue;
}> = ({ search, setSearch, className }) => {
  const t = useTranslations();
  return (
    <div className={cn(`relative`, className)}>
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        placeholder={t('Common.search')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="pl-9"
      />
    </div>
  );
};

export default SearchInput;
