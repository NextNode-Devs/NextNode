import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { isAuthConfigured } from "@/shared/config/env.public";
import { Toaster } from "@/shared/ui/organisms/toaster";

/**
 * App-wide providers. Clerk is mounted only when its publishable key is set,
 * so the app (and CI, which has no Clerk keys) still runs without sign-in.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const content = (
    <>
      {children}
      {/* Phase 2 prototype kit (NN-31): renders `toast()` / `underConstruction()`. */}
      <Toaster />
    </>
  );
  if (!isAuthConfigured()) return content;
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/onboarding"
      afterSignOutUrl="/"
    >
      {content}
    </ClerkProvider>
  );
}
