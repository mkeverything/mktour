import { AppError } from '@/lib/errors';

export function getLichessTeamLinkErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    throw new AppError('UNEXPECTED_LINK_ERROR_SHAPE');
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') {
    throw new AppError('UNEXPECTED_LINK_ERROR_SHAPE');
  }

  const issues = JSON.parse(message);
  if (!Array.isArray(issues)) {
    throw new AppError('UNEXPECTED_LINK_ERROR_SHAPE');
  }

  for (const issue of issues) {
    if (!isIssue(issue)) throw new AppError('UNEXPECTED_LINK_ERROR_SHAPE');

    if (
      issue.message.startsWith('LINK_TEAM_ERROR') &&
      issue.path.join('.') === 'lichessTeam'
    ) {
      return issue.message;
    }
  }

  return null;
}

export function isLichessTeamLinkError(error: unknown): boolean {
  try {
    return getLichessTeamLinkErrorMessage(error) !== null;
  } catch {
    return false;
  }
}

function isIssue(issue: unknown) {
  return (
    !!issue &&
    typeof issue === 'object' &&
    'message' in issue &&
    'path' in issue &&
    typeof issue.message === 'string' &&
    Array.isArray(issue.path)
  );
}
