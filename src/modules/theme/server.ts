import { cookies, headers } from "next/headers";

import {
  THEME_COOKIE,
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/modules/theme/config";

export async function getRequestThemePreference(): Promise<ThemePreference> {
  const jar = await cookies();
  return parseThemePreference(jar.get(THEME_COOKIE)?.value);
}

export async function getRequestTheme(): Promise<{
  preference: ThemePreference;
  resolved: ResolvedTheme;
}> {
  const preference = await getRequestThemePreference();
  const headerStore = await headers();
  const systemDark =
    headerStore.get("sec-ch-prefers-color-scheme") === "dark";
  return {
    preference,
    resolved: resolveTheme(preference, systemDark),
  };
}
