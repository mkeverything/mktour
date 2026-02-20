import { getChangelog } from '@/lib/changelog';
import AboutContent from './about-content';

export default async function AboutPage() {
  const changelog = await getChangelog(3);

  return <AboutContent changelog={changelog} />;
}
