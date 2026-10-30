'use client';

import AddManagerDrawer from '@/app/[locale]/(routes)/clubs/my/(tabs)/settings/add-manager-drawer';
import FormattedMessage from '@/components/formatted-message';
import useDeleteClubManagerMutation from '@/components/hooks/mutation-hooks/use-club-delete-manager';
import { useClubManagers } from '@/components/hooks/query-hooks/use-club-managers';
import { useIntlError } from '@/components/hooks/use-intl-error';
import {
  Close,
  Content,
  Header,
  Root,
  Title,
  Trigger,
} from '@/components/ui-custom/combo-modal';
import { LoadingSpinner } from '@/components/ui-custom/loading-spinner';
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
import { ClubManagerModel } from '@/server/zod/clubs';
import { Trash2, User2 } from 'lucide-react';
import * as React from 'react';
import { FC } from 'react';
import { toast } from 'sonner';

const ClubManagersList: FC<{ clubId: string; userId: string }> = ({
  clubId,
  userId,
}) => {
  const { data, status, error } = useClubManagers(clubId);
  const { translateError } = useIntlError();
  const user = data?.find((amdin) => amdin.userId === userId);

  if (status === 'error') {
    toast.error(translateError(error, { fallback: 'USERS_NOT_LOADED' }));
  }

  return (
    <div className="gap-mk-2 flex flex-col">
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
                      key={manager.userId}
                      manager={manager}
                      index={index}
                      length={data.length}
                      user={user ?? null}
                      clubId={clubId}
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
  clubId: string;
}> = ({ manager, index, length, user, clubId }) => {
  const canDelete =
    user?.status === 'co-owner' &&
    manager.userId !== user.userId &&
    manager.status === 'admin';

  return (
    <React.Fragment key={manager.username}>
      <Item>
        <ItemContent className="gap-1">
          <ItemTitle>{manager.username}</ItemTitle>
          <ItemDescription>{manager.status}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm" asChild>
            <a href={`/user/${manager.username}`} className="flex gap-2">
              <User2 />
              <div className="hidden sm:block">
                <FormattedMessage id="Tournament.Table.Player.profile" />
              </div>
            </a>
          </Button>
          {canDelete && (
            <DeleteManagerButton clubId={clubId} userId={manager.userId} />
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
