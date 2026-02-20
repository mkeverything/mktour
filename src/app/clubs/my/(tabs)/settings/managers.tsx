'use client';

import AddManagerDrawer from '@/app/clubs/my/(tabs)/settings/add-manager-drawer';
import { LoadingSpinner } from '@/app/loading';
import FormattedMessage from '@/components/formatted-message';
import useDeleteClubManagerMutation from '@/components/hooks/mutation-hooks/use-club-delete-manager';
import { useClubManagers } from '@/components/hooks/query-hooks/use-club-managers';
import {
  Close,
  Content,
  Header,
  Root,
  Title,
  Trigger,
} from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { ClubManagerModel } from '@/server/db/zod/clubs';
import { Trash2, User2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { FC } from 'react';
import { toast } from 'sonner';

const ClubManagersList: FC<{ clubId: string; userId: string }> = ({
  clubId,
  userId,
}) => {
  const { data, status } = useClubManagers(clubId);
  const t = useTranslations('Club.Dashboard.Settings');
  const user = data?.find(
    ({ clubs_to_users: { userId } }) => userId === userId,
  );

  if (status === 'error') toast.error(t('search users error'));

  return (
    <div className="gap-mk flex flex-col">
      <h2 className="pl-4 text-sm">
        <FormattedMessage id="Club.managers list" />
      </h2>
      <Card className="bg-background sm:bg-card border-none shadow-none sm:border-solid sm:shadow">
        <CardContent className="p-0 sm:p-6">
          <div className="flex w-full flex-col gap-2">
            <ItemGroup>
              {!data ? (
                <Skeleton className="my-4 h-16 w-full" />
              ) : (
                <>
                  {data.map((manager, index) => (
                    <ManagerItem
                      key={manager.user.username}
                      manager={manager}
                      index={index}
                      length={data.length}
                      user={user ?? null}
                    />
                  ))}
                </>
              )}
            </ItemGroup>

            <AddManagerDrawer clubId={clubId} userId={userId} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ManagerItem: FC<{
  manager: ClubManagerModel;
  index: number;
  length: number;
  user: ClubManagerModel | null;
}> = ({ manager, index, length, user }) => {
  const canDelete =
    user?.clubs_to_users.status === 'co-owner' &&
    manager.user.id !== user.user.id &&
    manager.clubs_to_users.status === 'admin';

  return (
    <React.Fragment key={manager.user.username}>
      <Item>
        <ItemContent className="gap-1">
          <ItemTitle>{manager.user.username}</ItemTitle>
          <ItemDescription>{manager.clubs_to_users.status}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm" asChild>
            <a href={`/user/${manager.user.username}`} className="flex gap-2">
              <User2 />
              <div className="hidden sm:block">
                <FormattedMessage id="Tournament.Table.Player.profile" />
              </div>
            </a>
          </Button>
          {canDelete && (
            <DeleteManagerButton
              clubId={user.clubs_to_users.clubId}
              userId={manager.user.id}
            />
          )}
        </ItemActions>
      </Item>
      {index !== length - 1 && <ItemSeparator />}
    </React.Fragment>
  );
};

const DeleteManagerButton: FC<{
  clubId: string;
  userId: string;
}> = ({ clubId, userId }) => {
  const { mutate, isPending } = useDeleteClubManagerMutation();
  return (
    <Root>
      <Trigger asChild>
        <Button variant="destructive" className="flex gap-2" size="sm">
          <Trash2 />
          <div className="hidden sm:block">
            <FormattedMessage id="Club.Dashboard.Settings.delete" />
          </div>
        </Button>
      </Trigger>
      <Content>
        <Header>
          <Title>
            <FormattedMessage id="Common.confirm" />
          </Title>
        </Header>
        <Button
          variant="destructive"
          className="flex gap-2"
          onClick={() => {
            mutate({ clubId, userId });
          }}
          disabled={isPending}
        >
          {isPending ? <LoadingSpinner /> : <Trash2 />}
          <FormattedMessage id="Common.delete" />
        </Button>
        <Close asChild>
          <Button variant="outline">
            <FormattedMessage id="Common.cancel" />
          </Button>
        </Close>
      </Content>
    </Root>
  );
};

export default ClubManagersList;
