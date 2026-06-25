"use client";

import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";

export function StudioAccountControls() {
  const { user } = useUser();
  const name = user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "Profil";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="flex shrink-0 items-center gap-4">
      <SignOutButton redirectUrl="/">
        <button type="button" className="font-body text-[13px] text-black/50 transition-colors hover:text-black">
          Abmelden
        </button>
      </SignOutButton>
      <Link
        href="/studio/profile"
        aria-label="Profil öffnen"
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
