'use client';
// global search

import { Search } from 'lucide-react';
import * as React from 'react';

import { useSearchQuery } from '@/components/hooks/query-hooks/use-search-result';
import { useDebounce } from '@/components/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ClubModel } from '@/server/db/zod/clubs';
import { PlayerModel } from '@/server/db/zod/players';
import { UserModel } from '@/server/db/zod/users';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const { data, isLoading } = useSearchQuery({
    query: debouncedSearchQuery,
  });
  const router = useRouter();
  const t = useTranslations('GlobalSearch');

  const ACTIONS: Array<{
    title: string;
    shortcut?: string;
    href: string;
  }> = [
    {
      title: t('make tournament'),
      shortcut: '⌘M',
      href: '/tournaments/create',
    },
    {
      title: t('club dashboard'),
      shortcut: '⌘L',
      href: '/clubs/my',
    },
    {
      title: t('edit profile'),
      shortcut: '⌘P',
      href: '/user/edit',
    },
    {
      title: t('notifications'),
      href: '/notifications',
    },
    {
      title: t('lichess team'),
      href: 'https://lichess.org/team/mktour',
    },
    {
      title: t('my clubs'),
      href: '/clubs/my',
    },
    {
      title: t('my tournaments'),
      href: '/tournaments/my',
    },
    {
      title: t('new club'),
      href: '/clubs/create',
    },
  ];

  const filteredActions = ACTIONS.filter((action) =>
    action.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'm' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(false);
        router.push('/tournaments/create');
      }
      if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(false);
        router.push('/clubs/my');
      }
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(false);
        router.push('/user/edit');
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [router]);

  return (
    <>
      <Button
        variant="ghost"
        className="flex flex-row items-center justify-center gap-1 p-3 text-sm"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Search />
        <kbd className="bg-muted text-muted-foreground pointer-events-none hidden items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none lg:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">
          {t('search dialog title')}
        </DialogTitle>{' '}
        <DialogDescription className="sr-only">
          {t('search dialog description')}
        </DialogDescription>
        <div
          className="border-b-0.5 small-scrollbar flex items-center px-3"
          cmdk-input-wrapper=""
        >
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder={t('search placeholder')}
            className={
              'placeholder:text-muted-foreground flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50'
            }
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <CommandList className="small-scrollbar">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-2 p-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : data &&
            data?.players &&
            data?.players.length === 0 &&
            data?.tournaments &&
            data?.tournaments.length === 0 &&
            data?.users &&
            data?.users.length === 0 &&
            data?.clubs &&
            data?.clubs.length === 0 &&
            filteredActions.length === 0 ? (
            <div className="p-2">
              <p className="text-muted-foreground text-center text-sm">
                {t('not found')}
              </p>
            </div>
          ) : (
            <>
              {data && (
                <>
                  {data?.users && data?.users.length > 0 && (
                    <>
                      <CommandGroup heading={t('users')}>
                        {data.users.map((item: UserModel) => (
                          <Link key={item.id} href={`/user/${item.username}`}>
                            <CommandItem
                              value={item.id}
                              onSelect={() => {
                                router.push(`/user/${item.username}`);
                                setOpen(false);
                              }}
                            >
                              <span>{item.username}</span>
                            </CommandItem>
                          </Link>
                        ))}
                      </CommandGroup>
                      <CommandSeparator />
                    </>
                  )}
                  {'clubs' in data && data?.clubs && data?.clubs.length > 0 && (
                    <>
                      <CommandGroup heading={t('clubs')}>
                        {data?.clubs.map((item: ClubModel) => (
                          <Link key={item.id} href={`/clubs/${item.id}`}>
                            <CommandItem
                              value={item.id}
                              onSelect={() => {
                                router.push(`/clubs/${item.id}`);
                                setOpen(false);
                              }}
                            >
                              <span>{item.name}</span>
                            </CommandItem>
                          </Link>
                        ))}
                      </CommandGroup>
                      <CommandSeparator />
                    </>
                  )}

                  {data?.tournaments && data?.tournaments.length > 0 && (
                    <CommandGroup heading={t('tournaments')}>
                      {data.tournaments.map((item) => (
                        <Link key={item.id} href={`/tournaments/${item.id}`}>
                          <CommandItem
                            value={item.id}
                            onSelect={() => {
                              router.push(`/tournaments/${item.id}`);
                              setOpen(false);
                            }}
                          >
                            <span>{item.title}</span>
                          </CommandItem>
                        </Link>
                      ))}
                    </CommandGroup>
                  )}
                  <CommandSeparator />
                  {data?.players && data?.players.length > 0 && (
                    <>
                      <CommandGroup heading={t('players')}>
                        {data.players.map((item: PlayerModel) => (
                          <Link key={item.id} href={`/player/${item.id}`}>
                            <CommandItem
                              value={item.id}
                              onSelect={() => {
                                router.push(`/player/${item.id}`);
                                setOpen(false);
                              }}
                            >
                              <span>{item.nickname}</span>
                            </CommandItem>
                          </Link>
                        ))}
                      </CommandGroup>
                      <CommandSeparator />
                    </>
                  )}
                </>
              )}
              {filteredActions.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t('actions')}>
                    {filteredActions.slice(0, 3).map((action) => (
                      <Link key={action.title} href={action.href}>
                        <CommandItem
                          value={action.title}
                          onSelect={() => {
                            router.push(action.href);
                            setOpen(false);
                          }}
                        >
                          <span>{action.title}</span>
                          {action.shortcut && (
                            <CommandShortcut>{action.shortcut}</CommandShortcut>
                          )}
                        </CommandItem>
                      </Link>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
