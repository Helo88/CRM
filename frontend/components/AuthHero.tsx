import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { PresenceBadge } from "@/components/PresenceBadge";
import { Typewriter } from "@/components/Typewriter";

const POINT_KEYS = ["pointAi", "pointTickets", "pointBilingual"] as const;
const STAT_KEYS = ["responseTime", "coverage", "languages"] as const;

// Shared marketing panel for the login/register split layout — same value
// prop either way, only the floating form card next to it differs.
export async function AuthHero() {
  const t = await getTranslations("AuthHero");
  const tAuth = await getTranslations("Auth");

  return (
    <div className="flex min-h-[520px] flex-col justify-center gap-6 rounded-3xl bg-background p-8 shadow-pop md:p-12 md:pe-[42%] animate-in fade-in duration-500">
      <PresenceBadge label={<Typewriter text={tAuth("supportOnline")} />} />
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t("heading")}</h1>
        <p className="text-muted-foreground text-balance">{t("subheading")}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {POINT_KEYS.map((key) => (
          <li key={key} className="flex items-center gap-3 text-sm">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Check className="size-3.5" />
            </span>
            {t(key)}
          </li>
        ))}
      </ul>
      <div className="flex gap-6 border-t border-border pt-5">
        {STAT_KEYS.map((key) => (
          <div key={key}>
            <p className="text-lg font-bold">{t(`${key}Value`)}</p>
            <p className="text-xs text-muted-foreground">{t(`${key}Label`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
