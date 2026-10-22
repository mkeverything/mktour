import { ApiReference } from '@scalar/nextjs-api-reference';

export const GET = ApiReference({
  url: '/api/spec',
  title: 'mktour open api',
  showDeveloperTools: 'never',
  hideClientButton: true,
  hideModels: true,
  documentDownloadType: 'json',
  pageTitle: 'mktour open api',
});
