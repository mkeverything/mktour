'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { getAppErrorMessage } from '@/lib/errors';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import posthog from 'posthog-js';
import { useEffect } from 'react';
import { FallbackProps } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const t = useTranslations('ErrorBoundary');
  const tErrors = useTranslations('Errors');
  const message = getAppErrorMessage(error);

  useEffect(() => {
    posthog.capture('app_error_boundary', {
      error_code: message,
    });
  }, [message]);

  return (
    <div
      role="alert"
      className="flex min-h-[50vh] items-center justify-center p-4"
    >
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="text-destructive size-6" />
          <h2 className="text-lg font-semibold">{t('title')}</h2>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted overflow-auto rounded-md p-3 text-sm">
            {tErrors(message)}
          </pre>
        </CardContent>
        <CardFooter className="flex gap-2">
          {resetErrorBoundary && (
            <Button onClick={resetErrorBoundary} variant="default">
              {t('tryAgain')}
            </Button>
          )}
          <Button onClick={() => window.location.reload()} variant="outline">
            {t('reloadPage')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default ErrorFallback;
