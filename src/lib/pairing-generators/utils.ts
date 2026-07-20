import type { RoundProps } from '@/lib/pairing-generators/common-generator';
import { generateRoundRobinRound } from '@/lib/pairing-generators/round-robin-generator';
import { generateWeightedSwissRound } from '@/lib/pairing-generators/swiss-generator';
import { AppError } from '@/lib/errors';
import type { TournamentFormat } from '@/server/zod/enums';
import type { GameModel } from '@/server/zod/tournaments';

export function generateTournamentRound(
  format: TournamentFormat,
  props: RoundProps,
): GameModel[] {
  switch (format) {
    case 'swiss':
      return generateWeightedSwissRound(props);
    case 'round robin':
      return generateRoundRobinRound(props);
    default:
      throw new AppError('UNSUPPORTED_TOURNAMENT_FORMAT', {
        cause: `unsupported format: ${format satisfies never}`,
      });
  }
}
