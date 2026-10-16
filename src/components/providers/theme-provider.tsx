'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { PropsWithChildren, useLayoutEffect } from 'react';

const STORAGE_KEY = 'theme';

// a locale switch mounts a new root layout on the client, where inline scripts
// never run, so only the server html gets an executable one
const SCRIPT_PROPS = {
  type: typeof window === 'undefined' ? 'text/javascript' : 'text/plain',
};

export default function ThemeProvider({ children }: PropsWithChildren) {
  return (
    <NextThemesProvider
      attribute="class"
      storageKey={STORAGE_KEY}
      scriptProps={SCRIPT_PROPS}
      disableTransitionOnChange
    >
      <SavedThemeSync />
      {children}
    </NextThemesProvider>
  );
}

// switching back to a locale shows its hidden root layout again, with the theme
// it had when it was hidden
function SavedThemeSync() {
  const { theme, setTheme } = useTheme();

  useLayoutEffect(() => {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY);
      if (savedTheme && savedTheme !== theme) setTheme(savedTheme);
    } catch {}
  }, [theme, setTheme]);

  return null;
}
