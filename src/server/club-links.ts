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

export const resolveLinkIcon = (url: string) => {
  const domain = getDomain(url, TLDTS_OPTIONS);
  const exception = domain && DOMAIN_ICONS.get(domain);
  if (exception) return exception;
  const name = getDomainWithoutSuffix(url, TLDTS_OPTIONS);
  return name && ICON_PATHS.has(name) ? name : null;
};

export const getLinkIconPath = (icon: string | null) =>
  (icon && ICON_PATHS.get(icon)) || GLOBE_ICON_PATH;
