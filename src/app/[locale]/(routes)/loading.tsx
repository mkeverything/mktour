import { LoadingSpinner } from '@/components/ui-custom/loading-spinner';

export default function Loading() {
  return (
    <div className="h-mk-content-height flex w-full flex-auto items-center justify-center">
      <span className="sr-only">Loading...</span>
      <LoadingSpinner className="size-14" />
    </div>
  );
}
