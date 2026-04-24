import { DashboardTab } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import tabs from '@/app/tournaments/[id]/dashboard/tabs';
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
  useState,
} from 'react';

const CarouselContainer: FC<CarouselProps> = ({
  currentTab,
  setCurrentTab,
  setScrolling,
}) => {
  const [api, setApi] = useState<CarouselApi>();
  const indexOfTab = tabs.findIndex((tab) => tab.title === currentTab);

  const handleSelect = useCallback(() => {
    if (!api) return;
    const num = api.selectedScrollSnap();
    setCurrentTab(tabs[num].title);
  }, [api, setCurrentTab]);

  useEffect(() => {
    if (!api) return;
    api.on('select', handleSelect);
    if (currentTab) api.scrollTo(indexOfTab);
  }, [api, currentTab, indexOfTab, handleSelect]);

  return (
    <Carousel setApi={setApi} opts={{ loop: false }}>
      {/* calculating content height to prevent carousel from overflow-y-scroll (screen - nav + controls) */}
      <CarouselContent className="h-[calc(100dvh-6rem)]">
        {tabs.map((tab) => (
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
  currentTab: DashboardTab;
  setCurrentTab: Dispatch<SetStateAction<DashboardTab>>;
  setScrolling: Dispatch<SetStateAction<boolean>>;
};

export default CarouselContainer;
