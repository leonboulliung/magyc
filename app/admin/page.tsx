import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { isAdmin } from "@/lib/server/admin";
import { AdminConsole } from "./AdminConsole";

export const dynamic = "force-dynamic";

/**
 * /admin — protected console. Gated by ADMIN_USER_IDS env var. When a
 * signed-in but non-admin user lands here, the page shows their own
 * Clerk userId so they can paste it into the env var (.env.local for
 * local, Vercel project settings for prod) and re-deploy.
 */
export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  if (!isAdmin(userId)) {
    return (
      <div className="app-shell">
        <Header />
        <main className="animate-fadeIn">
          <div className="max-w-2xl mx-auto px-4 sm:px-8 py-16 space-y-6">
            <h1 className="editorial font-black text-[40px] sm:text-[56px] leading-[0.95]">
              Not in the admin list.
            </h1>
            <p className="text-[15px] leading-relaxed opacity-80">
              Add your Clerk userId to the <code className="mono text-[13px] bg-ink/[0.05] px-1.5 py-0.5 rounded">ADMIN_USER_IDS</code>{" "}
              env var (comma-separated when more than one), then redeploy.
            </p>
            <div className="border border-rule-strong rounded-2xl p-4 bg-paper">
              <div className="mono text-[10px] tracking-widest opacity-70 mb-2">
                YOUR CLERK ID
              </div>
              <code className="mono text-[14px] break-all">{userId}</code>
            </div>
            <Link href="/" className="btn ghost inline-block">
              ← Back to Paris
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain animate-fadeIn">
        <AdminConsole />
      </main>
    </div>
  );
}
