import { turboPascal } from '@/app/fonts';
import { LoadingSpinner } from '@/app/loading';
import ClientTypeAnimation from '@/app/not-found-client';
import '@/styles/cursor.css';
import Link from 'next/link';
import { Suspense } from 'react';

export default function NotFound() {
  return (
    <div
      className={`${turboPascal.className} h-mk-content-height flex flex-auto items-center justify-center align-middle`}
    >
      <main className="w-64">
        <h1 className="text-3xl font-semibold">error 404</h1>
        <Suspense fallback={<LoadingSpinner className="size-8" />}>
          <ClientTypeAnimation />
        </Suspense>
        <Link href="/" className="hover:text-foreground/70 text-3xl underline">
          return home
        </Link>
      </main>
    </div>
  );
}
