"use client";

import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import { useT } from "@/components/i18n/LocaleProvider";

export function StudioAccountControls() {
  const t = useT();
  const { user } = useUser();
  const name = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || t.studio.navAccount;
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="flex shrink-0 items-center gap-4">
      <SignOutButton redirectUrl="/">
        <button type="button" className="font-body text-[13px] text-black/50 transition-colors hover:text-black">
          {t.auth.signOut}
        </button>
      </SignOutButton>
      <Link
        href="/studio/konto"
        aria-label={t.messages.accountOpen}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-black/[0.06] text-[12px] font-semibold text-black/70 transition-transform hover:scale-105"
        title={name}
      >
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </Link>
    </div>
  );
}
