import { TabType } from '@/app/[locale]/(routes)/tournaments/[id]/dashboard';
import Games from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs/games';
import Main from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs/main';
import TournamentTable from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/tabs/table';

const tabs: TabType[] = [
  { title: 'main', component: Main },
  { title: 'table', component: TournamentTable },
  { title: 'games', component: Games },
];

export default tabs;
