import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="w-full">
      <h2 className="py-2 text-center">
        <Skeleton className="mx-auto h-10 w-52" />
      </h2>
      <div className="mx-auto flex max-w-[min(600px,98%)] flex-col gap-6">
        <div className="flex flex-col gap-4 pt-2">
          <h2 className="pl-4">
            <Skeleton className="h-6 w-32" />
          </h2>
          <Card className="bg-background sm:bg-card w-full border-none shadow-none sm:border-solid sm:shadow-2xs">
            <CardContent className="p-2 sm:p-8">
              <div className="flex flex-col gap-8">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Button disabled className="w-full" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="gap-mk flex w-full flex-col">
          <h2 className="flex w-fit items-center gap-2 pl-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-3 rounded-full" />
          </h2>

          <Card className="bg-background sm:bg-card w-full border-none px-2 shadow-none sm:border-solid sm:pt-6 sm:shadow-2xs">
            <CardContent className="gap-mk flex flex-col p-0 sm:p-6 sm:pt-2">
              <div className="flex w-full justify-between pb-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-8" />
              </div>
              <div className="space-y-4">
                <div className="flex w-full justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>

              <div className="gap-mk-2 py-mk mt-4 flex">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="pl-4">
            <Skeleton className="h-6 w-32" />
          </h2>
          <Card className="bg-background sm:bg-card w-full border-none shadow-none sm:border-solid sm:shadow-2xs">
            <CardContent className="p-mk flex flex-col gap-4 sm:p-8">
              <Button className="hw-full" disabled />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
