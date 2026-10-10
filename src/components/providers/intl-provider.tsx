'use client';

import { AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';

const IntlProvider = ({
  children,
  ...props
}: {
  children: ReactNode;
  messages: AbstractIntlMessages;
  locale: string;
}) => {
  return (
    <NextIntlClientProvider
      locale={props.locale}
      messages={props.messages}
      timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
};

export default IntlProvider;
