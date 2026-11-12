import { useTranslations } from 'next-intl';
import { FC } from 'react';

/** the ? after a rating that has not settled yet */
const ProvisionalMark: FC = () => {
  const t = useTranslations('Player.Page');
  return (
    <abbr
      title={t('provisional')}
      className="text-muted-foreground font-normal no-underline"
    >
      ?
    </abbr>
  );
};

export default ProvisionalMark;
