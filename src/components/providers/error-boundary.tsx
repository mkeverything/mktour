'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { FallbackProps } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] items-center justify-center p-4"
    >
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-2">
          <AlertTriangle className="text-destructive size-6" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted overflow-auto rounded-md p-3 text-sm">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </CardContent>
        <CardFooter className="flex gap-2">
          {resetErrorBoundary && (
            <Button onClick={resetErrorBoundary} variant="default">
              Try again
            </Button>
          )}
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload page
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default ErrorFallback;
