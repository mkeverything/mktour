import SignInWithLichessButton from '@/components/auth/sign-in-with-lichess-button';
import HomeText from '@/components/home-text';
import '@/styles/cursor.css';

export default function Unauthorized() {
  return (
    <div className="h-mk-content-height flex w-full flex-col gap-7 p-3.5 md:gap-2 md:pb-8">
      <HomeText />
      <SignInWithLichessButton />
    </div>
  );
}
