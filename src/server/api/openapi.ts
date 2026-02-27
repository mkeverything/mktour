import { BASE_URL } from '@/lib/config/urls';
import { appRouter } from '@/server/api';
import {
  generateOpenApiDocument,
  GenerateOpenApiDocumentOptions,
} from 'trpc-to-openapi';

const parameters: GenerateOpenApiDocumentOptions = {
  title: 'mktour open api',
  version: '1.0.0',
  baseUrl: `${BASE_URL}/api`,
  description:
    'the list of availible mktour endpoints for external use\n\n IMPORTANT: you are still at mktour.org which means your website-authorization is active here. protected endpoints will authorize you even without API token, unless you return to the homepage and log out. ',
  tags: ['users', 'auth', 'clubs', 'tournaments', 'players', 'search'],
};

export const getOpenApiDocument = () => {
  return generateOpenApiDocument(appRouter, parameters);
};
