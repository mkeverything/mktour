export function getLichessTeamLinkErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;

  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') return null;

  const issues = safeParseIssues(message);
  if (!issues) return null;

  for (const issue of issues) {
    if (
      issue.message.startsWith('LINK_TEAM_ERROR') &&
      issue.path.join('.') === 'lichessTeam'
    ) {
      return issue.message;
    }
  }

  return null;
}

function safeParseIssues(message: string) {
  try {
    const issues = JSON.parse(message);
    return Array.isArray(issues) && issues.every(isIssue) ? issues : null;
  } catch {
    return null;
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
