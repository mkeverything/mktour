const SPLASH_DIR = '/splash';

type ApplePwaStartupImage = {
  url: string;
  media?: string;
};

/**
 * device media query per pixel-dimension pair.
 * keys = `WxH` matching filenames `apple-splash-{W}-{H}.jpg` in `public/splash/`.
 * media queries taken from radioznb-site (proven working on iOS).
 */
const SPLASH_BY_DIMS: Record<string, string> = {
  '1320-2868':
    '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '1206-2622':
    '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '1290-2796':
    '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '1179-2556':
    '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '1284-2778':
    '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '1260-2736':
    '(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '1170-2532':
    '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '1125-2436':
    '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '1242-2688':
    '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '828-1792':
    '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '1242-2208':
    '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  '750-1334':
    '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '640-1136':
    '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '1488-2266':
    '(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '1536-2048':
    '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '1620-2160':
    '(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '1640-2360':
    '(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '1668-2224':
    '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '1668-2388':
    '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '2048-2732':
    '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
  '2868-1320':
    '(device-width: 956px) and (device-height: 440px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '2622-1206':
    '(device-width: 874px) and (device-height: 402px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '2796-1290':
    '(device-width: 932px) and (device-height: 430px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '2556-1179':
    '(device-width: 852px) and (device-height: 393px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '2778-1284':
    '(device-width: 926px) and (device-height: 428px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '2736-1260':
    '(device-width: 912px) and (device-height: 420px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '2532-1170':
    '(device-width: 844px) and (device-height: 390px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '2436-1125':
    '(device-width: 812px) and (device-height: 375px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '2688-1242':
    '(device-width: 896px) and (device-height: 414px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '1792-828':
    '(device-width: 896px) and (device-height: 414px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
  '2208-1242':
    '(device-width: 736px) and (device-height: 414px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)',
  '1334-750':
    '(device-width: 667px) and (device-height: 375px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
  '1136-640':
    '(device-width: 568px) and (device-height: 320px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
  '2266-1488':
    '(device-width: 1133px) and (device-height: 744px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
  '2048-1536':
    '(device-width: 1024px) and (device-height: 768px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
  '2160-1620':
    '(device-width: 1080px) and (device-height: 810px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
  '2360-1640':
    '(device-width: 1180px) and (device-height: 820px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
  '2224-1668':
    '(device-width: 1112px) and (device-height: 834px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
  '2388-1668':
    '(device-width: 1194px) and (device-height: 834px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
  '2732-2048':
    '(device-width: 1366px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)',
};

function buildSplashStartupImages(): ApplePwaStartupImage[] {
  const out: ApplePwaStartupImage[] = [];
  for (const dims of Object.keys(SPLASH_BY_DIMS)) {
    const deviceMedia = SPLASH_BY_DIMS[dims];
    out.push({
      url: `${SPLASH_DIR}/apple-splash-${dims}.jpg`,
      media: `(prefers-color-scheme: light) and ${deviceMedia}, (prefers-color-scheme: no-preference) and ${deviceMedia}`,
    });
    out.push({
      url: `${SPLASH_DIR}/apple-splash-dark-${dims}.jpg`,
      media: `(prefers-color-scheme: dark) and ${deviceMedia}`,
    });
  }
  return out;
}

export const applePwaSplashStartupImages = buildSplashStartupImages();
