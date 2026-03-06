const MAX_TEAM_NICKNAME_LENGTH = 30;

const SEPARATORS = ' \t.,;:_/\\|()[]{}<>!?@#$%^&*+=~`\'"-';

const SEPARATOR_REGEX = (() => {
  const escaped = SEPARATORS.replace(/\\/g, '\\\\')
    .replace(/]/g, '\\]')
    .replace(/-/g, '\\-');
  return new RegExp(`[${escaped}]+`);
})();

export function deriveTeamNickname(
  firstNickname: string,
  secondNickname: string,
): string {
  const firstPart =
    firstNickname.split(SEPARATOR_REGEX).filter(Boolean)[0]?.trim() ||
    firstNickname.trim() ||
    '?';
  const secondPart =
    secondNickname.split(SEPARATOR_REGEX).filter(Boolean)[0]?.trim() ||
    secondNickname.trim() ||
    '?';
  return `${firstPart} + ${secondPart}`.slice(0, MAX_TEAM_NICKNAME_LENGTH);
}
