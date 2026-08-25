import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { logout } from "./actions";

export async function LogoutButton() {
  const t = await getTranslations("Auth");

  return (
    <form action={logout}>
      <Button type="submit" variant="outline">
        {t("logOut")}
      </Button>
    </form>
  );
}
