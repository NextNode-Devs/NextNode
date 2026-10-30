import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { isAuthConfigured } from "@/shared/config/env.public";

/**
 * App-wide providers. Clerk is mounted only when its publishable key is set,
 * so the app (and CI, which has no Clerk keys) still runs without sign-in.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  if (!isAuthConfigured()) return children;
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding"
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
