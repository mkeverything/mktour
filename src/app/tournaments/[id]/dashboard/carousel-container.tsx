import { DashboardContextType } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { getTabsForMockMode } from '@/app/tournaments/[id]/dashboard/tabs';
import useScrollableContainer from '@/components/hooks/use-scrollable-container';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';
import {
  Dispatch,
  FC,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

const CarouselContainer: FC<CarouselProps> = ({
  currentTab,
  setCurrentTab,
  setScrolling,
  mockMode,
}) => {
  const [api, setApi] = useState<CarouselApi>();
  const visibleTabs = useMemo(() => getTabsForMockMode(mockMode), [mockMode]);
  const indexOfTab = visibleTabs.findIndex((tab) => tab.title === currentTab);
  const indexToShow = indexOfTab >= 0 ? indexOfTab : 0;

  const handleSelect = useCallback(() => {
    if (!api) return;
    const num = api.selectedScrollSnap();
    const tab = visibleTabs[num];
    if (tab) setCurrentTab(tab.title as DashboardContextType['currentTab']);
  }, [api, setCurrentTab, visibleTabs]);

  useEffect(() => {
    if (!api) return;
    api.on('select', handleSelect);
    if (currentTab) api.scrollTo(indexToShow);
  }, [api, currentTab, indexToShow, handleSelect]);

  return (
    <Carousel setApi={setApi} opts={{ loop: false }}>
      <CarouselContent className="h-[calc(100dvh-6rem)]">
        {visibleTabs.map((tab) => (
          <CarouselIteratee
            setScrolling={setScrolling}
            key={tab.title}
            currentTab={currentTab}
          >
            {tab.component}
          </CarouselIteratee>
        ))}
      </CarouselContent>
    </Carousel>
  );
};

const CarouselIteratee: FC<{
  children: FC;
  currentTab: string;
  setScrolling?: Dispatch<SetStateAction<boolean>>;
}> = ({ children: Component, currentTab, setScrolling }) => {
  const ref = useScrollableContainer({ setScrolling });

  useEffect(() => {
    if (currentTab) {
      ref.current?.scrollTo({ top: 0 });
    }
  }, [currentTab, ref]);

  return (
    <CarouselItem>
      <div className="h-full overflow-y-auto">
        <Component />
      </div>
    </CarouselItem>
  );
};

type CarouselProps = {
  currentTab: DashboardContextType['currentTab'];
  setCurrentTab: Dispatch<SetStateAction<DashboardContextType['currentTab']>>;
  setScrolling: Dispatch<SetStateAction<boolean>>;
  mockMode: DashboardContextType['mockMode'];
};

export default CarouselContainer;
