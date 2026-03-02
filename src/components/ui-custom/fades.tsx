import { FC } from 'react';

const Fades: FC<{ from: string; to: string }> = ({ from, to }) => {
  return (
    <>
      <div
        className={`h-mk-2 bg-red absolute top-0 w-full bg-linear-to-b to-transparent ${from}`}
      />
      <div
        className={`h-mk-2 ${to} absolute bottom-0 w-full bg-linear-to-b from-transparent`}
      />
    </>
  );
};

export default Fades;
