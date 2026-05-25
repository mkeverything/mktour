import {
  ERRORS,
  getAppErrorMessage,
  getAppErrorTrpcCode,
  type AppErrorMessage,
} from '@/lib/errors';
import { AppRouter } from '@/server/api';
import { TRPCClientErrorLike } from '@trpc/client';
import { TranslationValues, useTranslations } from 'next-intl';

export const useIntlError = () => {
  const tErrors = useTranslations('Errors');

  const translateError = (
    error: TRPCClientErrorLike<AppRouter>,
    props: {
      fallback?: AppErrorMessage;
      options?: TranslationValues;
    } = {},
  ) => {
    const message = getAppErrorMessage(error);
    const trpcCode = getAppErrorTrpcCode(message);
    const resolvedMessage =
      message === ERRORS.UNKNOWN_ERROR && props.fallback
        ? props.fallback
        : `${message} (${trpcCode})`;

    return tErrors(resolvedMessage, props.options);
  };

  const translateMessage = (
    message: AppErrorMessage,
    options?: TranslationValues,
  ) => tErrors(message, options);

  return { translateMessage, translateError };
};
