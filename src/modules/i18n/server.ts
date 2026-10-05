import { cookies } from "next/headers";

import {
  LOCALE_COOKIE,
  LOCALE_META,
  type Locale,
  parseLocale,
} from "@/modules/i18n/config";
import { getMessages } from "@/modules/i18n/messages";

export async function getRequestLocale(): Promise<Locale> {
  const store = await cookies();
  return parseLocale(store.get(LOCALE_COOKIE)?.value);
}

export async function getRequestI18n() {
  const locale = await getRequestLocale();
  return {
    locale,
    dir: LOCALE_META[locale].dir,
    t: getMessages(locale),
  };
}
