"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import {
  LOCALE_COOKIE,
  LOCALE_META,
  type Locale,
  parseLocale,
} from "@/modules/i18n/config";
import { getMessages, type Messages } from "@/modules/i18n/messages";

type I18nContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Messages;
  setLocale: (locale: Locale) => void;
  pending: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function persistLocale(locale: Locale) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${maxAge}; samesite=lax`;
  document.documentElement.lang = locale;
  document.documentElement.dir = LOCALE_META[locale].dir;
  document.documentElement.dataset.locale = locale;
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(parseLocale(initialLocale));
  const [pending, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      const localeValue = parseLocale(next);
      setLocaleState(localeValue);
      persistLocale(localeValue);
      startTransition(() => {
        router.refresh();
      });
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: LOCALE_META[locale].dir,
      t: getMessages(locale),
      setLocale,
      pending,
    }),
    [locale, pending, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return context;
}
