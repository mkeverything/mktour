import { ERRORS, getAppErrorCode, type AppErrorCode } from '@/lib/errors';
import { AppRouter } from '@/server/api';
import { TRPCClientErrorLike } from '@trpc/client';
import { TranslationValues, useTranslations } from 'next-intl';

export const useIntlError = () => {
  const tErrors = useTranslations('Errors');

  const translateError = (
    error: TRPCClientErrorLike<AppRouter>,
    props: {
      fallback?: AppErrorCode;
      options?: TranslationValues;
    } = {},
  ) => {
    const code = getAppErrorCode(error);
    return tErrors(
      code === ERRORS.UNKNOWN_ERROR && props.fallback ? props.fallback : code,
      props.options,
    );
  };

  const translateCode = (code: AppErrorCode, options?: TranslationValues) =>
    tErrors(code, options);

  return { translateCode, translateError };
};
