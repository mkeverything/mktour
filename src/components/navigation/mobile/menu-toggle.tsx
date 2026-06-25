import { MotionProps, motion } from 'framer-motion';

const MenuToggle = ({ toggle }: { toggle: () => void }) => (
  <button
    onClick={toggle}
    className="text-foreground right-mk pointer-events-auto absolute top-[calc(18px+var(--spacing-mk-safe-area-top))] z-30 stroke-none"
  >
    <svg width="23" height="23" viewBox="0 0 23 23">
      <Path
        variants={{
          closed: { d: 'M 2 2.5 L 20 2.5' },
          open: { d: 'M 3 16.5 L 17 2.5' },
        }}
      />
      <Path
        variants={{
          closed: { d: 'M 2 9.423 L 20 9.423', opacity: 1 },
          open: { opacity: 0 },
        }}
        transition={{ duration: 0.1 }}
      />
      <Path
        variants={{
          closed: { d: 'M 2 16.346 L 20 16.346' },
          open: { d: 'M 3 2.5 L 17 16.346' },
        }}
      />
    </svg>
    <span className="sr-only">navigation menu</span>
  </button>
);

const Path = (props: MotionProps) => (
  <motion.path
    className="fill-primary stroke-primary"
    strokeWidth="2"
    strokeLinecap="round"
    {...props}
  />
);

export default MenuToggle;
