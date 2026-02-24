'use client';

import { useAuthSelectClub } from '@/components/hooks/mutation-hooks/use-auth-select-club';
import { useAuthClubs } from '@/components/hooks/query-hooks/use-user-clubs';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { UserModel } from '@/server/db/zod/users';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { FC } from 'react';
import { toast } from 'sonner';

const ClubSelect: FC<{ user: UserModel }> = ({ user }) => {
  const { data: clubs, status } = useAuthClubs();
  const queryClient = useQueryClient();
  const clubSelection = useAuthSelectClub(queryClient);
  const t = useTranslations('Toasts');

  if (status === 'error')
    toast.error(t('server error'), {
      id: 'error',
      duration: 3000,
    });
  if (status !== 'success') return <SelectSkeleton />;
  const placeholder = clubs.find((club) => club.id === user.selectedClub)
    ?.name ?? <SelectSkeleton />;
  const sortedClubs = clubs.sort((a, b) =>
    a.id === user.selectedClub ? -1 : b.id === user.selectedClub ? 1 : 0,
  );

  if (clubs.length === 0)
    return (
      <div className="p-mk m-auto w-full lg:px-[20%]">
        <Card className="bg-card border-primary/10 shadow-background/50 w-full rounded-lg px-3 py-2 text-sm shadow-md">
          {placeholder}
        </Card>
      </div>
    );
  return (
    <Select
      value={user.selectedClub}
      onValueChange={(value) =>
        clubSelection.mutate({
          clubId: value,
        })
      }
    >
      <div className="p-mk m-auto w-full lg:px-[20%]">
        <SelectTrigger className="bg-card border-primary/10 shadow-background/50 w-full shadow-md">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
      </div>
      {sortedClubs && (
        <SelectContent
          position="item-aligned"
          collisionPadding={0}
          className="-translate-x-0.5"
        >
          {sortedClubs.map(SelectItemIteratee)}
        </SelectContent>
      )}
    </Select>
  );
};

const SelectItemIteratee = (props: ClubSelectProps) => {
  return (
    <SelectItem key={props.id} value={props.id}>
      {props.name}
    </SelectItem>
  );
};
const SelectSkeleton = () => (
  <div className="h-8 w-full px-5 pt-3 pb-1">
    <Skeleton className="h-full w-full" />
  </div>
);

type ClubSelectProps = { id: string; name: string };

export default ClubSelect;
