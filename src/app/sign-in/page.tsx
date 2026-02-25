import SignInWithLichessButton from '@/components/auth/sign-in-with-lichess-button';
import { publicCaller } from '@/server/api';
import { SearchParams } from 'next/dist/server/request/search-params';
import { redirect } from 'next/navigation';
import { Suspense, ViewTransition } from 'react';

const PageContent = async (props: { searchParams: Promise<SearchParams> }) => {
  const searchParams = await props.searchParams;

  const from =
    typeof searchParams.from === 'string' ? searchParams.from : undefined;
  const user = await publicCaller.auth.info();
  if (user) redirect('/');
  return (
    <main className="p-mk-2 h-mk-content-height mx-auto my-4 flex w-full max-w-lg flex-auto items-center justify-center">
      <SignInWithLichessButton className="py-16" from={from} />
    </main>
  );
};

const Page = async (props: { searchParams: Promise<SearchParams> }) => {
  return (
    <Suspense
      fallback={
        <main className="h-mk-content-height mx-auto my-4 flex w-full max-w-lg flex-auto items-center justify-center p-10">
          <SignInWithLichessButton className="p-10 py-16" />
        </main>
      }
    >
      <ViewTransition>
        <PageContent {...props} />
      </ViewTransition>
    </Suspense>
  );
};

export default Page;
