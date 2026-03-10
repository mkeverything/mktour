'use client';

import Empty from '@/components/empty';
import FormattedMessage from '@/components/formatted-message';
import { useTournaments } from '@/components/hooks/query-hooks/use-tournaments';
import { useDebounce } from '@/components/hooks/use-debounce';
import useOnReach from '@/components/hooks/use-on-reach';
import SkeletonList from '@/components/skeleton-list';
import TournamentItemIteratee from '@/components/tournament-item';
import ClubSearchInput from '@/components/ui-custom/club-search-input';
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
  tournamentFormatEnum,
  tournamentStatusEnum,
  tournamentTypeEnum,
  type TournamentFormat,
  type TournamentStatus,
  type TournamentType,
} from '@/server/zod/enums';
import { ButtonProps } from '@base-ui/react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dispatch, FC, SetStateAction, useState } from 'react';

type Rated = boolean | null;

export default function TournamentsAllList() {
  const [search, setSearch] = useState('');
  const [rated, setRated] = useState<Rated>(null);
  const [formats, setFormat] = useState<TournamentFormat[]>([]);
  const [types, setType] = useState<TournamentType[]>([]);
  const [status, setStatus] = useState<TournamentStatus[]>([]);

  return (
    <div className="mk-list">
      <Search
        search={search}
        formats={formats}
        types={types}
        status={status}
        rated={rated}
        setFormat={setFormat}
        setType={setType}
        setStatus={setStatus}
        setSearch={setSearch}
        setRated={setRated}
      />
      <Content
        search={search}
        formats={formats}
        types={types}
        status={status}
        rated={rated}
      />
    </div>
  );
}

const Content: FC<ContentProps> = ({
  search,
  rated,
  formats,
  types,
  status,
}) => {
  const debouncedSearch = useDebounce(search, 300);
  const {
    data: tournaments,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useTournaments({
    search: debouncedSearch.trim().length ? debouncedSearch : undefined,
    rated: rated ?? undefined,
    formats: formats.length ? formats : undefined,
    types: types.length ? types : undefined,
    statuses: status.length ? status : undefined,
  });
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
  setFormat,
  setType,
  setStatus,
  setRated,
}) => {
  const tCommon = useTranslations('Common');
  const tMakeTournament = useTranslations('MakeTournament');
  const tTournamentsAll = useTranslations('TournamentsAll');

  const formatItems = Object.values(tournamentFormatEnum.enum);
  const typeItems = Object.values(tournamentTypeEnum.enum);
  const statusItems = Object.values(tournamentStatusEnum.enum);

  const ratedSelectValue = rated === null ? 'all' : rated ? 'rated' : 'unrated';

  const handleReset = () => {
    setSearch('');
    setFormat([]);
    setType([]);
    setStatus([]);
    setRated(null);
  };

  const touched =
    !!search.length ||
    !!formats.length ||
    !!types.length ||
    !!status.length ||
    !!rated;

  return (
    <div className="gap-mk flex w-full flex-col pb-0">
      <ClubSearchInput
        search={search}
        setSearch={setSearch}
        className="w-full"
      />
      <div className="text-muted-foreground gap-mk flex w-full flex-1 grow flex-wrap text-xs">
        <div className="grow">
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
          onValueChange={(value: TournamentFormat[]) =>
            setFormat(value as TournamentFormat[])
          }
        >
          <ComboboxChips>
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
          onValueChange={(value: TournamentType[]) =>
            setType(value as TournamentType[])
          }
        >
          <ComboboxChips>
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
          onValueChange={(value: TournamentStatus[]) =>
            setStatus(value as TournamentStatus[])
          }
        >
          <ComboboxChips>
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
        <ResetButton onClick={handleReset} touched={touched} />
      </div>
    </div>
  );
};

const ResetButton: FC<ButtonProps & { touched: boolean }> = ({
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
  formats: TournamentFormat[];
  types: TournamentType[];
  status: TournamentStatus[];
  rated: Rated;
  setFormat: Dispatch<SetStateAction<TournamentFormat[]>>;
  setType: Dispatch<SetStateAction<TournamentType[]>>;
  setStatus: Dispatch<SetStateAction<TournamentStatus[]>>;
  setRated: Dispatch<SetStateAction<Rated>>;
};

type ContentProps = Pick<
  SearchProps,
  'search' | 'formats' | 'types' | 'status' | 'rated'
>;
