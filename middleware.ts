import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// The Creator Suite is account-first: every /studio route requires a
// signed-in user. Everything else (homepage demo, public spaces, API)
// stays open.
const isStudio = createRouteMatcher(["/studio(.*)"]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  // Redirect root domain (magyc.site) to www (www.magyc.site)
  const host = request.headers.get("host") || "";
  if (host === "magyc.site") {
    const url = request.nextUrl.clone();
    url.hostname = "www.magyc.site";
    return NextResponse.redirect(url, { status: 301 });
  }

  if (isStudio(request)) {
    const { userId } = await auth();
    if (!userId) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
