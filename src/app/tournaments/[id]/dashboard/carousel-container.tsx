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
    <Carousel setApi={setApi} opts={{ loop: false }} className="select-none">
      <CarouselContent className="h-[calc(100dvh_-_var(--spacing-mk-navbar-total-height)_-_2.5rem)]">
        {tabs.map((tab) => (
          <CarouselIteratee setScrolling={setScrolling} key={tab.title}>
            {tab.component}
          </CarouselIteratee>
        ))}
      </CarouselContent>
    </Carousel>
  );
};

const CarouselIteratee: FC<{
  children: FC;
  setScrolling?: Dispatch<SetStateAction<boolean>>;
}> = ({ children: Component, setScrolling }) => {
  const ref = useScrollableContainer({ setScrolling });

  return (
    <CarouselItem>
      <div
        ref={ref}
        className="small-scrollbar h-full overflow-y-scroll overscroll-y-contain pb-[calc(6rem_+_env(safe-area-inset-bottom))]"
      >
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
