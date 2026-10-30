import { TriangleAlertIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";

import { RefreshButton } from "./refresh-button";

/** Data for the page could not be loaded (API down, timeout). Retrying re-renders the page. */
export function LoadError({ title, message }: { title: string; message: string }) {
  return (
    <Card role="alert">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TriangleAlertIcon className="size-5 text-destructive" aria-hidden />
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{message} Try again in a moment.</CardDescription>
      </CardHeader>
      <CardContent>
        <RefreshButton label="Try again" />
      </CardContent>
    </Card>
  );
}

/** Placeholder cards while a page's data loads. */
export function LoadingCards({ count = 2, label }: { count?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}
