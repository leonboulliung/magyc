import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Redirect root domain (magyc.site) to www (www.magyc.site)
function redirectRootToWWW(request: NextRequest) {
  const host = request.headers.get("host") || "";
  if (host === "magyc.site") {
    const url = request.nextUrl.clone();
    url.hostname = "www.magyc.site";
    return NextResponse.redirect(url, { status: 301 });
  }
  return null;
}

// Clerk middleware + domain redirect
const clerkAuth = clerkMiddleware();

export default async function middleware(request: NextRequest) {
  // Try domain redirect first
  const domainRedirect = redirectRootToWWW(request);
  if (domainRedirect) return domainRedirect;

  // Then run Clerk middleware
  return clerkAuth(request);
};

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
