import { TabType } from '@/app/(routes)/tournaments/[id]/dashboard';
import Games from '@/app/(routes)/tournaments/[id]/dashboard/tabs/games';
import Main from '@/app/(routes)/tournaments/[id]/dashboard/tabs/main';
import TournamentTable from '@/app/(routes)/tournaments/[id]/dashboard/tabs/table';

const tabs: TabType[] = [
  { title: 'main', component: Main },
  { title: 'table', component: TournamentTable },
  { title: 'games', component: Games },
];

export default tabs;
