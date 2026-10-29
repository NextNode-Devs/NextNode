"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/shared/ui/shadcn/button";

/** Re-asks the server for the deposit status; the page re-renders with it. */
export function RefreshButton({ label = "Check again" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? (
        <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <RefreshCwIcon aria-hidden />
      )}
      {pending ? "Checking…" : label}
    </Button>
  );
}
