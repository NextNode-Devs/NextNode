import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

import { isAuthConfigured } from "@/shared/config/env.public";

/**
 * Next.js 16 Proxy. It only redirects signed-out visitors away from protected
 * pages; who may do what is decided by the backend use cases, never here.
 */
const PROTECTED = ["/dashboard(.*)", "/onboarding(.*)", "/projects(.*)", "/conversations(.*)"];
const isProtected = createRouteMatcher(PROTECTED);

const SIGN_IN_PATH = "/sign-in";

function signInRedirect(request: NextRequest): NextResponse {
  const target = new URL(SIGN_IN_PATH, request.url);
  target.searchParams.set("redirect_url", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(target);
}

const withClerk = clerkMiddleware(
  async (auth, request) => {
    if (isProtected(request)) await auth.protect();
  },
  { signInUrl: SIGN_IN_PATH, signUpUrl: "/sign-up" },
);

/** Without Clerk keys nobody can be signed in, so protected pages always redirect. */
function withoutClerk(request: NextRequest): NextResponse {
  return isProtected(request) ? signInRedirect(request) : NextResponse.next();
}

export default isAuthConfigured() ? withClerk : withoutClerk;

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
