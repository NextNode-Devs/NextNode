import { SignIn, SignUp } from "@clerk/nextjs";
import { Suspense, type ReactNode } from "react";

import { isAuthConfigured } from "@/shared/config/env.public";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";

import { AuthUnavailable } from "./auth-unavailable";

function AuthLayout({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-4 py-12 sm:py-16">
      <header className="space-y-2 text-center">
        <p className="text-sm font-medium text-highlight">NextNode</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{intro}</p>
      </header>
      <div className="w-full [&_.cl-rootBox]:mx-auto [&_.cl-rootBox]:max-w-full">
        {isAuthConfigured() ? (
          // Clerk's forms read the URL, which is only known per request.
          <Suspense fallback={<Skeleton role="status" aria-label="Loading" className="mx-auto h-96 w-full max-w-sm rounded-xl" />}>
            {children}
          </Suspense>
        ) : (
          <AuthUnavailable />
        )}
      </div>
    </main>
  );
}

/** Email or Google sign-in. Clerk returns the visitor to `redirect_url` afterwards. */
export function SignInView() {
  return (
    <AuthLayout title="Sign in" intro="Welcome back. Sign in with your email or Google.">
      <SignIn />
    </AuthLayout>
  );
}

/** Registration. New accounts continue to onboarding to choose a role. */
export function SignUpView() {
  return (
    <AuthLayout title="Create your account" intro="Register with your email or Google, then choose your role.">
      <SignUp />
    </AuthLayout>
  );
}
