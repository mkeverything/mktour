import 'server-only';

import { GLOBE_ICON_PATH } from '@/lib/club-links';
import * as simpleIcons from 'simple-icons';
import { getDomain, getDomainWithoutSuffix } from 'tldts';

const ICON_PATHS = new Map(
  Object.values(simpleIcons).map(({ slug, path }) => [slug, path]),
);

const DOMAIN_ICONS = new Map([
  ['bsky.app', 'bluesky'],
  ['chess.com', 'chessdotcom'],
  ['discord.gg', 'discord'],
  ['fb.com', 'facebook'],
  ['fb.me', 'facebook'],
  ['instagr.am', 'instagram'],
  ['linktr.ee', 'linktree'],
  ['ok.ru', 'odnoklassniki'],
  ['redd.it', 'reddit'],
  ['t.me', 'telegram'],
  ['twitter.com', 'x'],
  ['wa.me', 'whatsapp'],
  ['youtu.be', 'youtube'],
]);

const TLDTS_OPTIONS = { allowPrivateDomains: true };

export const getLinkIconPath = (url: string) => {
  const domain = getDomain(url, TLDTS_OPTIONS);
  const slug =
    (domain && DOMAIN_ICONS.get(domain)) ||
    getDomainWithoutSuffix(url, TLDTS_OPTIONS);
  return (slug && ICON_PATHS.get(slug)) || GLOBE_ICON_PATH;
};
