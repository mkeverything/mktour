'use client';

import { LoadingSpinner } from '@/app/loading';
import { useTokenGenerateMutation } from '@/components/hooks/mutation-hooks/use-token-generate';
import { useTokenRevokeMutation } from '@/components/hooks/mutation-hooks/use-token-revoke';
import { useTRPC } from '@/components/trpc/client';
import ComboModal, {
  Content,
  Description,
} from '@/components/ui-custom/combo-modal';
import HalfCard from '@/components/ui-custom/half-card';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ApiTokenModel } from '@/server/db/zod/users';
import { useQuery } from '@tanstack/react-query';
import { Copy, Eye, EyeOff, Info, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC, useState } from 'react';
import { toast } from 'sonner';

export default function ApiTokens() {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.auth.apiToken.list.queryOptions());
  const [open, setOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [isBlurred, setIsBlurred] = useState(true);

  const { mutate, isPending } = useTokenGenerateMutation();

  const t = useTranslations('UserSettings.Tokens');

  const copyToken = () => {
    if (generatedToken && navigator.clipboard) {
      navigator.clipboard.writeText(generatedToken);
      toast.success(t('copied'));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newTokenName = formData.get('name') as string;

    if (newTokenName?.trim()) {
      mutate(
        { name: newTokenName },
        {
          onSuccess: ({ token }) => {
            setGeneratedToken(token);
            setOpen(true);
            setIsBlurred(true);
          },
        },
      );
      e.currentTarget.reset();
    }
  };

  return (
    <div className="gap-mk flex w-full flex-col">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <h2 className="flex w-fit items-center gap-2 pl-4">
              {t('header')}
              <Info className="h-3 w-3" />
            </h2>
          </TooltipTrigger>
          <TooltipContent className="overflow-auto">
            <p className="whitespace-pre-line">{t('description')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <HalfCard className="w-full px-2 sm:pt-6">
        {isLoading ? (
          <Skeleton className="mt-2 h-12 sm:mx-6 sm:mb-6" />
        ) : (
          <CardContent className="gap-mk flex flex-col p-0 sm:p-6 sm:pt-2">
            {data?.length === 0 ? (
              <p className="text-muted-foreground text-center text-xs">
                {t('empty')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-muted-foreground text-xs">
                    <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('created')}</TableHead>
                    <TableHead>{t('last used')}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{data?.map(ApiTokenIteratee)}</TableBody>
              </Table>
            )}

            <form onSubmit={handleSubmit}>
              <div className="gap-mk-2 py-mk flex">
                <Input
                  name="name"
                  placeholder={t('new token name')}
                  required
                  className="flex-1 lowercase"
                />
                <Button type="submit" disabled={isPending}>
                  {isPending ? <LoadingSpinner /> : <Plus />}
                  {isPending ? t('making') : t('make')}
                </Button>
              </div>
            </form>
            {data && data.length > 0 && (
              <CardFooter className="center text-muted-foreground mx-auto px-0 text-xs">
                {t('test tokens')}&nbsp;
                <Link
                  href="/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary underline transition-all"
                >
                  {t('here')}
                </Link>
              </CardFooter>
            )}
          </CardContent>
        )}
      </HalfCard>

      <ComboModal.Root open={open} onOpenChange={setOpen}>
        <ComboModal.Title className="sr-only">
          api token generated
        </ComboModal.Title>
        <Content>
          <div className="flex flex-col gap-4">
            <ComboModal.Header className="mx-0 p-0">
              <Description className="text-left">
                {t('modal description')}
              </Description>
            </ComboModal.Header>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  readOnly
                  value={
                    isBlurred
                      ? '••••••••••••••••••••••••••••••••'
                      : generatedToken || ''
                  }
                  className="font-mono"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsBlurred(!isBlurred)}
                title={isBlurred ? 'reveal token' : 'hide token'}
              >
                {isBlurred ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={copyToken}
                title="copy to clipboard"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-destructive text-sm">{t('modal warning')}</p>
          </div>
        </Content>
      </ComboModal.Root>
    </div>
  );
}

const ApiTokenIteratee = (token: ApiTokenModel) => {
  return <ApiTokenRow token={token} key={token.id} />;
};

const ApiTokenRow: FC<{ token: ApiTokenModel }> = ({ token }) => {
  const locale = useLocale();
  const { mutate: revoke, isPending: isRevoking } = useTokenRevokeMutation();
  return (
    <TableRow key={token.id}>
      <TableCell className="font-medium lowercase">{token.name}</TableCell>
      <TableCell className="text-muted-foreground text-xs lowercase">
        {token.createdAt.toLocaleDateString([locale])}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs lowercase">
        {token.lastUsedAt ? token.lastUsedAt.toLocaleDateString([locale]) : '-'}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={() => revoke({ id: token.id })}
          disabled={isRevoking}
        >
          {isRevoking ? <LoadingSpinner /> : <Trash2 />}
          <span className="sr-only">revoke</span>
        </Button>
      </TableCell>
    </TableRow>
  );
};
