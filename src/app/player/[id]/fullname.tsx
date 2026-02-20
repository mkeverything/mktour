'use client';

import FormattedMessage from '@/components/formatted-message';
import { PlayerModel } from '@/server/db/zod/players';
import { UserMinimalModel } from '@/server/db/zod/users';

const FullName = ({
  player,
  user,
}: {
  player: PlayerModel;
  user: UserMinimalModel | null;
}) => {
  let name;
  if (!user && !player.realname) return null;
  if (!user) {
    name = player.realname;
  } else {
    name = user.name ?? player.realname;
  }
  return (
    <div>
      <FormattedMessage id="Player.realname" />
      {': '}
      <span className="font-semibold">{name}</span>
    </div>
  );
};

export default FullName;
