import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export default clerkMiddleware((auth, request: NextRequest) => {
  // Redirect root domain (magyc.site) to www (www.magyc.site)
  const host = request.headers.get("host") || "";
  if (host === "magyc.site") {
    const url = request.nextUrl.clone();
    url.hostname = "www.magyc.site";
    return NextResponse.redirect(url, { status: 301 });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
