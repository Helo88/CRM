import { getRequestConfig } from "next-intl/server";

// Single hardcoded locale for now — infra only. Story 49 ("Bilingual Arabic &
// English UI") replaces this with real locale detection (cookie/user setting)
// and adds messages/ar.json; every string added before then must still go
// through useTranslations/getTranslations so that story is "add ar.json and
// switch the locale", not "hunt down every hardcoded string in the app".
export default getRequestConfig(async () => {
  const locale = "en";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
