import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locale";

// Story 49 ("Bilingual Arabic & English UI"): real locale detection via a
// cookie, no [locale] URL segment — every string was already routed through
// useTranslations/getTranslations from the start (see the original comment
// this replaced), so this is the only file that needed to change.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
