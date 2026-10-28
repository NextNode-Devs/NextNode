import { Badge } from "@/shared/ui/shadcn/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";

import type { Health } from "../api/get-health";

type Props =
  | { state: "loading" }
  | { state: "ready"; health: Health }
  | { state: "error"; message: string };

const ROWS: { key: keyof Health; label: string; good: string }[] = [
  { key: "status", label: "API", good: "ok" },
  { key: "database", label: "Database", good: "ok" },
  { key: "auth", label: "Clerk verification", good: "configured" },
];

/** Presentational: renders one of the three states it is given. */
export function BackendStatusCard(props: Props) {
  return (
    <Card aria-busy={props.state === "loading"}>
      <CardHeader>
        <CardTitle>Backend connection</CardTitle>
        <CardDescription>Live result of the Django API health check.</CardDescription>
      </CardHeader>
      <CardContent>
        {props.state === "loading" && (
          <div className="space-y-2" role="status" aria-label="Checking the backend">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </div>
        )}

        {props.state === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {props.message} Start the backend with <code>uv run python manage.py runserver</code>{" "}
            from <code>backend/</code>, then reload.
          </p>
        )}

        {props.state === "ready" && (
          <dl className="divide-y divide-border">
            {ROWS.map(({ key, label, good }) => {
              const value = props.health[key];
              const healthy = value === good;
              return (
                <div key={key} className="flex items-center justify-between py-2 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>
                    <Badge
                      variant="outline"
                      className={healthy ? "border-success text-success" : "border-warning text-warning"}
                    >
                      {value}
                    </Badge>
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
