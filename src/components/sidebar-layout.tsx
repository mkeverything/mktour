import { FC, PropsWithChildren, ReactNode } from 'react';

/**
 * a page that fits the viewport on desktop: a sidebar ruled off from the content,
 * each scrolling on its own. on a phone the page scrolls as one
 */
const SidebarLayout: FC<PropsWithChildren<{ sidebar: ReactNode }>> = ({
  sidebar,
  children,
}) => (
  <div
    data-fixed-viewport
    className="lg:h-mk-content-height p-mk-2 flex w-full flex-col gap-4 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[17rem_minmax(0,1fr)]"
  >
    <header className="lg:small-scrollbar shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:border-r lg:pr-4">
      {sidebar}
    </header>
    {children}
  </div>
);

export default SidebarLayout;
