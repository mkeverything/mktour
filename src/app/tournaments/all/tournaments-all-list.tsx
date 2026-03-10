'use client';

import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import {
  TournamentsFilterInput,
  useTournaments,
} from '@/components/hooks/query-hooks/use-tournaments';
import { useDebounce } from '@/components/hooks/use-debounce';
import useOnReach from '@/components/hooks/use-on-reach';
import { useTournamentsFilters } from '@/components/hooks/use-tournaments-filters';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import SkeletonList from '@/components/skeleton-list';
import TournamentItemIteratee from '@/components/tournament-item';
import SearchInput from '@/components/ui-custom/search-input';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
} from '@/components/ui/combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  implementedTournamentFormatEnum,
  TournamentFormatImplemented,
  tournamentStatusEnum,
  tournamentTypeEnum,
  type TournamentFormat,
  type TournamentStatus,
  type TournamentType,
} from '@/server/zod/enums';
import { Filter, FilterX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ComponentProps, FC, useContext, useState } from 'react';

export default function TournamentsAllList() {
  const { search, queryFilter, ...filters } = useTournamentsFilters();

  const debouncedSearch = useDebounce(search, 300);
  const queryFilterWithDebounce = {
    ...queryFilter,
    search: debouncedSearch.trim().length ? debouncedSearch : undefined,
  };

  return (
    <div className="mk-list gap-mk-2">
      <Search search={search} {...filters} />
      <Content queryFilter={queryFilterWithDebounce} />
    </div>
  );
}

const Content: FC<{ queryFilter: TournamentsFilterInput }> = ({
  queryFilter,
}) => {
  const {
    data: tournaments,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useTournaments(queryFilter);
  const isEmpty = !tournaments?.pages[0].tournaments.length;
  const ref = useOnReach(fetchNextPage);

  if (isLoading) return <SkeletonList />;
  if (isEmpty) return <Empty messageId="tournamentsAll" />;

  return (
    <>
      {tournaments?.pages.map((page) => (
        <div key={page.nextCursor ?? 'first'} className="mk-list pb-0">
          {page.tournaments.map((props) => (
            <TournamentItemIteratee key={props.tournament.id} {...props} />
          ))}
        </div>
      ))}
      {isFetchingNextPage && <SkeletonList />}
      {hasNextPage && <div ref={ref} />}
    </>
  );
};

const Search: FC<SearchProps> = ({
  search,
  formats,
  types,
  status,
  rated,
  setSearch,
  setFormats,
  setTypes,
  setStatus,
  setRated,
  touched,
  reset,
}) => {
  const tCommon = useTranslations('Common');
  const tMakeTournament = useTranslations('MakeTournament');
  const tTournamentsAll = useTranslations('TournamentsAll');

  const formatItems = Object.values(implementedTournamentFormatEnum.enum);
  const typeItems = Object.values(tournamentTypeEnum.enum);
  const statusItems = Object.values(tournamentStatusEnum.enum);

  const ratedSelectValue = rated === null ? 'all' : rated ? 'rated' : 'unrated';

  const { isMobile } = useContext(MediaQueryContext);

  const [visible, setVisible] = useState(!isMobile);

  const handleVisibleChange = () => {
    if (!visible) setVisible(true);
    else {
      setVisible(false);
      reset();
    }
  };

  return (
    <div
      className={`${visible ? 'gap-mk' : 'gap-0'} relative flex h-fit w-full flex-col transition-all duration-300`}
    >
      <SearchInput search={search} setSearch={setSearch} className="w-full" />
      <Button
        onClick={handleVisibleChange}
        variant="ghost"
        className="text-muted-foreground absolute top-0 right-0 block md:hidden"
      >
        {visible ? <FilterX /> : <Filter />}
      </Button>
      <div
        className={`text-muted-foreground gap-mk flex flex-wrap overflow-hidden text-xs transition-all duration-300 ${
          visible ? 'max-h-dvh opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div>
          <Select
            value={ratedSelectValue}
            onValueChange={(value) => {
              if (value === 'all') return setRated(null);
              if (value === 'rated') return setRated(true);
              return setRated(false);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={tTournamentsAll('rated heading')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tCommon('all')}</SelectItem>
              <SelectItem value="rated">{tMakeTournament('rated')}</SelectItem>
              <SelectItem value="unrated">
                {tMakeTournament('unrated')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Combobox
          items={formatItems}
          multiple
          value={formats}
          onValueChange={setFormats}
        >
          <ComboboxChips className="grow">
            <ComboboxValue>
              {formats.map((item) => (
                <ComboboxChip key={item}>{tMakeTournament(item)}</ComboboxChip>
              ))}
            </ComboboxValue>
            <ComboboxChipsInput placeholder={tTournamentsAll('formats')} />
          </ComboboxChips>
          <ComboboxContent>
            <ComboboxEmpty>
              <FormattedMessage id="Empty.search" />
            </ComboboxEmpty>
            <ComboboxList>
              {(item: TournamentFormat) => (
                <ComboboxItem key={item} value={item}>
                  {tMakeTournament(item)}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Combobox
          items={typeItems}
          multiple
          value={types}
          onValueChange={setTypes}
        >
          <ComboboxChips className="grow">
            <ComboboxValue>
              {types.map((item) => (
                <ComboboxChip key={item}>
                  {tMakeTournament(`Types.${item}`)}
                </ComboboxChip>
              ))}
            </ComboboxValue>
            <ComboboxChipsInput placeholder={tTournamentsAll('types')} />
          </ComboboxChips>
          <ComboboxContent>
            <ComboboxEmpty>
              <FormattedMessage id="Empty.search" />
            </ComboboxEmpty>
            <ComboboxList>
              {(item: TournamentType) => (
                <ComboboxItem key={item} value={item}>
                  {tMakeTournament(`Types.${item}`)}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <Combobox
          items={statusItems}
          multiple
          value={status}
          onValueChange={setStatus}
        >
          <ComboboxChips className="grow">
            <ComboboxValue>
              {status.map((item) => (
                <ComboboxChip key={item}>
                  {tTournamentsAll(`status.${item}`)}
                </ComboboxChip>
              ))}
            </ComboboxValue>
            <ComboboxChipsInput placeholder={tTournamentsAll('status.title')} />
          </ComboboxChips>
          <ComboboxContent>
            <ComboboxEmpty>
              <FormattedMessage id="Empty.search" />
            </ComboboxEmpty>
            <ComboboxList>
              {(item: TournamentStatus) => (
                <ComboboxItem key={item} value={item}>
                  {tTournamentsAll(`status.${item}`)}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <ResetButton onClick={reset} touched={touched} />
      </div>
    </div>
  );
};

const ResetButton: FC<ComponentProps<'button'> & { touched: boolean }> = ({
  onClick,
  touched,
}) => {
  if (!touched) return null;
  return (
    <Button size="icon" variant="ghost" onClick={onClick}>
      <X />
    </Button>
  );
};

type SearchProps = {
  search: string;
  setSearch: (value: string) => void;
  formats: TournamentFormatImplemented[];
  types: TournamentType[];
  status: TournamentStatus[];
  rated: boolean | null;
  setFormats: (value: TournamentFormatImplemented[]) => void;
  setTypes: (value: TournamentType[]) => void;
  setStatus: (value: TournamentStatus[]) => void;
  setRated: (value: boolean | null) => void;
  touched: boolean;
  reset: () => void;
};
