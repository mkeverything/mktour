import { Card } from '@/components/ui/card';
import { GameResult } from '@/server/zod/enums';
import { FC } from 'react';

const GameItemExpanded: FC<GameProps> = ({ result, player1, player2 }) => {
  return (
    <Card
      className={`flex w-full flex-row items-center justify-between gap-2 border p-4 md:max-w-[250px]`}
    >
      <div className="flex max-w-[90%] flex-col gap-2">
        <div className={`truncate ${result === '0-1' && 'opacity-30'}`}>
          {player1}
        </div>
        <div className={`truncate ${result === '1-0' && 'opacity-30'}`}>
          {player2}
        </div>
      </div>
      <Result result={result} />
    </Card>
  );
};

const Result = ({ result }: { result: GameResult | null }) => {
  // FIXME Intl
  const resultP1 = result === '1-0' ? '1' : result === '1/2-1/2' ? '½' : '0';
  const resultP2 = result === '1-0' ? '0' : result === '1/2-1/2' ? '½' : '1';

  if (!result) return null;

  return (
    <div className={`flex w-[1rem] flex-col items-center justify-center gap-2`}>
      <div className={`${result === '0-1' && 'opacity-30'}`}>{resultP1}</div>
      <div className={`${result === '1-0' && 'opacity-30'}`}>{resultP2}</div>
    </div>
  );
};

interface GameProps {
  result: GameResult | null;
  setResult: () => void;
  player1: string;
  player2: string;
}

export default GameItemExpanded;
