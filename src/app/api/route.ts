// app/reference/route.ts
import { ApiReference } from '@scalar/nextjs-api-reference';

const config = {
  url: '/api/spec',
  title: 'mktour open api',
  showDeveloperTools: 'never',
  hideClientButton: true,
  hideModels: true,
  documentDownloadType: 'json',
  pageTitle: 'mktour open api',
} satisfies Parameters<typeof ApiReference>[0];

export const GET = ApiReference(config);
