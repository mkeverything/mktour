import SignInWithLichessButton from '@/components/auth/sign-in-with-lichess-button';
import MakeTournamentButton from '@/components/button-make-tournament';
import HomeText from '@/components/home-text';
import '@/styles/cursor.css';

export default function Unauthorized() {
  return (
    <div className="h-mk-content-height flex w-full flex-col gap-7 p-3.5 md:gap-2 md:pb-8">
      <HomeText />
      <div className="flex flex-col items-center justify-center gap-4 md:mx-auto md:flex-row md:gap-2 md:px-12">
        <SignInWithLichessButton />
        <MakeTournamentButton />
      </div>
    </div>
  );
}
