// src/app/[...trpc]/route.ts
import { toAppError } from '@/lib/errors';
import { appRouter } from '@/server/api';
import { createTRPCContext } from '@/server/api/trpc';
import { getHTTPStatusCodeFromError } from '@trpc/server/http';
import { NextRequest } from 'next/server';
import { createOpenApiFetchHandler } from 'trpc-to-openapi';

if (process.env.NODE_ENV === 'development') {
  const globalRegistry = (
    globalThis as { __zod_globalRegistry?: { clear: () => void } }
  ).__zod_globalRegistry;
  globalRegistry?.clear();
}

const handler = async (req: NextRequest) => {
  try {
    return await createOpenApiFetchHandler({
      endpoint: '/api',
      router: appRouter,
      createContext: () => createTRPCContext({ headers: req.headers, req }),
      req,
    });
  } catch (error) {
    const appError = toAppError(error);
    const status = getHTTPStatusCodeFromError(appError);

    return Response.json(
      {
        message: appError.message,
        code: appError.code,
        data: {
          code: appError.code,
          httpStatus: status,
          details: appError.details,
        },
      },
      { status },
    );
  }
};

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
