import { promises as fs } from 'fs';
import path from 'path';

export interface ChangeItem {
  description: string;
  commitHash?: string;
  commitUrl?: string;
}

export interface ChangelogVersion {
  version: string;
  date: string;
  categories: {
    features: ChangeItem[];
    bug_fixes: ChangeItem[];
    others: ChangeItem[];
  };
}

export async function getChangelog(limit = 3): Promise<ChangelogVersion[]> {
  const filePath = path.join(process.cwd(), 'CHANGELOG.md');

  try {
    await fs.access(filePath);
  } catch {
    return [];
  }

  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const versions: ChangelogVersion[] = [];
  let currentVersion: ChangelogVersion | null = null;
  let currentCategory: keyof ChangelogVersion['categories'] = 'others';

  const versionRegex =
    /^(?:#|##)\s+(?:\[?(\d+\.\d+\.\d+)\]?.*)\s+\((\d{4}-\d{2}-\d{2})\)/;

  for (const line of lines) {
    const match = line.match(versionRegex);
    if (match) {
      if (versions.length >= limit) break;
      currentVersion = {
        version: match[1],
        date: match[2],
        categories: {
          features: [],
          bug_fixes: [],
          others: [],
        },
      };
      versions.push(currentVersion);
      currentCategory = 'others';
      continue;
    }

    if (!currentVersion) continue;

    const categoryMatch = line.match(/^###\s+(.*)/);
    if (categoryMatch) {
      const categoryTitle = categoryMatch[1].toLowerCase();
      if (categoryTitle.includes('feature')) {
        currentCategory = 'features';
      } else if (categoryTitle.includes('bug fix')) {
        currentCategory = 'bug_fixes';
      } else {
        currentCategory = 'others';
      }
      continue;
    }

    if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
      const change = line.trim().substring(1).trim();
      if (change) {
        // extract commit info if present
        const commitMatch = change.match(
          /\s\(\[([0-9a-f]{7})\]\((https:\/\/github\.com\/.*)\)\)$/i,
        );

        let description = change;
        let commitHash: string | undefined;
        let commitUrl: string | undefined;

        if (commitMatch) {
          description = change.replace(commitMatch[0], '');
          commitHash = commitMatch[1];
          commitUrl = commitMatch[2];
        }

        currentVersion.categories[currentCategory].push({
          description,
          commitHash,
          commitUrl,
        });
      }
    }
  }

  return versions;
}
