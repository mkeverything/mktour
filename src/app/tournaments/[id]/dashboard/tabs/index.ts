import type { MockMode } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { type TabType } from '@/app/tournaments/[id]/dashboard';
import Games from '@/app/tournaments/[id]/dashboard/tabs/games';
import Main from '@/app/tournaments/[id]/dashboard/tabs/main';
import TournamentTable from '@/app/tournaments/[id]/dashboard/tabs/table';

const tabs: TabType[] = [
  { title: 'main', component: Main },
  { title: 'table', component: TournamentTable },
  { title: 'games', component: Games },
];

const isElimination = (m: MockMode) =>
  m === 'single_elim' || m === 'double_elim';

export const getTabsForMockMode = (mockMode: MockMode): TabType[] =>
  isElimination(mockMode) ? tabs.filter((tab) => tab.title !== 'table') : tabs;

export default tabs;
