import { clerkMiddleware } from "@clerk/nextjs/server";

// No protected routes yet — every surface is public until the new app's
// concept dictates otherwise. Clerk's middleware still runs so auth state
// is available to every page; we just don't enforce sign-in anywhere.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
