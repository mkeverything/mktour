import { Team } from '@/types/lichess-api';
import { cookies } from 'next/headers';

export const getUserLichessTeams = async (
  username: string,
): Promise<Team[]> => {
  try {
    const token = (await cookies()).get('token')?.value;
    const res = await fetch(`https://lichess.org/api/team/of/${username}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch teams: ${res.statusText}`);
    }
    const teamsFull = (await res.json()) as Array<Team>;
    return teamsFull.filter((team) =>
      team.leaders.find((leader) => leader.id === username),
    );
  } catch (e) {
    console.error(`ERROR: unable to connect to lichess. ${e}`);
    return [];
  }
};
