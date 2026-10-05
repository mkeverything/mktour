import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';

export default function LoadingForm() {
  return (
    <div className="w-full" sr-only="loading...">
      <h2 className="w-full py-2 text-center">
        <Skeleton className="mx-auto h-10 w-52" />
      </h2>
      <Card className="bg-background sm:bg-card mx-auto max-w-[min(600px,98%)] border-none shadow-none sm:border-solid sm:shadow-2xs">
        <CardContent className="p-4 sm:p-8">
          <div className="flex flex-col gap-8">
            <div>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue>
                    <Skeleton className="h-4 w-32" />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <SelectGroup>
                      <Link
                        href="/clubs/create"
                        className="m-0 box-border h-[30px] w-full p-0"
                      >
                        <Button
                          variant="ghost"
                          className="text-muted-foreground flex h-[30px] w-full flex-row justify-end gap-2 pl-7 font-extrabold"
                        >
                          <PlusIcon fontStyle="bold" />{' '}
                          <Skeleton className="h-4 w-16" />
                        </Button>
                      </Link>
                    </SelectGroup>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                <Skeleton className="h-4 w-16" />
              </Label>
              <Input autoComplete="off" disabled />
            </div>
            <div>
              <Select disabled defaultValue="round robin">
                <SelectTrigger>
                  <SelectValue placeholder="choose a format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <RadioGroup
              defaultValue="solo"
              className="grid grid-cols-3 gap-2 sm:gap-4"
            >
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </RadioGroup>
            <div>
              <Button
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  'text-muted-foreground',
                )}
                disabled
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <div className="peer flex items-center space-x-2">
                <Label htmlFor="rated" className="text-muted-foreground">
                  <Skeleton className="h-4 w-16" />
                </Label>
                <Switch id="rated" disabled />
              </div>
              <div className="text-muted-foreground hidden text-sm peer-hover:block">
                <span className="text-xs">*</span>
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Button disabled className="w-full">
              <Skeleton className="h-10 w-full" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
