import AddManager from '@/app/(routes)/clubs/my/(tabs)/settings/add-manager';
import Fab from '@/components/fab';

import { useDebounce } from '@/components/hooks/use-debounce';
import SideDrawer from '@/components/ui-custom/side-drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchIcon, UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const AddManagerDrawer = ({
  clubId,
  userId,
}: {
  clubId: string;
  userId: string;
}) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const debouncedValue = useDebounce(value, 300);
  const t = useTranslations('Club.Dashboard.Settings');
  const [isAnimating, setIsAnimating] = useState(false);

  const handleChange = (state: boolean) => {
    if (!isAnimating) {
      setOpen(state);
      setValue('');
    }
  };

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        onClick={() => handleChange(true)}
        className="flex w-full gap-2"
      >
        <UserPlus />
        {t('add manager')}
      </Button>
      <SideDrawer open={open} setOpen={setOpen} setIsAnimating={setIsAnimating}>
        <div className="flex flex-col gap-3"></div>
        <div className="w-full">
          <div className="flex flex-col gap-3">
            <div className="flex flex-row items-center justify-center gap-3">
              <SearchIcon />
              <Input
                autoFocus
                className="drop-shadow-md"
                id="user-search"
                placeholder={t('search')}
                onChange={(e) => setValue(e.target.value)}
                value={value}
              />
            </div>
            <AddManager
              debouncedValue={debouncedValue}
              handleClose={() => handleChange(false)}
              clubId={clubId}
              userId={userId}
            />
          </div>
          <Fab
            className={`${(open || isAnimating) && 'z-60'} ${!open && 'hidden'}`}
            onClick={() => handleChange(false)}
            icon={X}
          />
        </div>
      </SideDrawer>
    </>
  );
};

export default AddManagerDrawer;
