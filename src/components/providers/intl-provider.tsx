'use client';

import { AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { ReactNode, useEffect } from 'react';

const IntlProvider = ({
  children,
  ...props
}: {
  children: ReactNode;
  messages: AbstractIntlMessages;
  locale: string;
}) => {
  useEffect(() => {
    document.documentElement.lang = props.locale;
  }, [props.locale]);

  return (
    <NextIntlClientProvider
      locale={props.locale}
      messages={props.messages}
      now={new Date()}
      timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
};

export default IntlProvider;
