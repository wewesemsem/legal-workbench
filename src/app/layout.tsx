import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";

import { LanguageBar } from "@/components/i18n/language-selector";
import { LOCALE_META } from "@/modules/i18n/config";
import { LocaleProvider } from "@/modules/i18n/provider";
import { getRequestLocale } from "@/modules/i18n/server";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Lawyer Workbench",
  description:
    "AI-native legal workbench for Middle East lawyers — starting with Egypt.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getRequestLocale();
  const dir = LOCALE_META[locale].dir;

  return (
    <html
      lang={locale}
      dir={dir}
      data-locale={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LocaleProvider initialLocale={locale}>
          <LanguageBar />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
