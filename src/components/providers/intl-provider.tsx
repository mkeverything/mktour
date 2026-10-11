'use client';

import type { Locale } from '@/lib/locales';
import { AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';

const IntlProvider = ({
  children,
  ...props
}: {
  children: ReactNode;
  messages: AbstractIntlMessages;
  locale: Locale;
}) => (
  <NextIntlClientProvider
    {...props}
    timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
  >
    {children}
  </NextIntlClientProvider>
);

export default IntlProvider;
