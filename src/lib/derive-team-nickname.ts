const MAX_TEAM_NICKNAME_LENGTH = 30;

export function deriveTeamNickname(
  firstNickname: string,
  secondNickname: string,
): string {
  const firstPart =
    firstNickname
      .split(/[^a-zA-Z]+/)
      .filter(Boolean)[0]
      ?.trim() ||
    firstNickname.trim() ||
    '?';
  const secondPart =
    secondNickname
      .split(/[^a-zA-Z]+/)
      .filter(Boolean)[0]
      ?.trim() ||
    secondNickname.trim() ||
    '?';
  return `${firstPart} + ${secondPart}`.slice(0, MAX_TEAM_NICKNAME_LENGTH);
}
