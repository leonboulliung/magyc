import { redirect } from "next/navigation";

// Profil + Einstellungen were merged into the Konto page. Keep this path as a
// redirect so old links/bookmarks still work.
export default function SettingsRedirect() {
  redirect("/studio/konto");
}
