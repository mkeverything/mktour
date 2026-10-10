'use client';

import dynamic from 'next/dynamic';

// reads route params, which are unknown while prerendering dynamic routes
const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then((mod) => mod.SpeedInsights),
  { ssr: false },
);

export default SpeedInsights;
