export const LOCALES = ["en", "fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lw_locale";

export const LOCALE_META: Record<
  Locale,
  { label: string; nativeLabel: string; dir: "ltr" | "rtl" }
> = {
  en: { label: "English", nativeLabel: "English", dir: "ltr" },
  fr: { label: "French", nativeLabel: "Français", dir: "ltr" },
  ar: { label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && LOCALES.includes(value as Locale));
}

export function parseLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
