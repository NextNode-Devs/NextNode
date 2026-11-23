import { EyeOffIcon, RocketIcon } from "lucide-react";

import {
  hiddenConfidentialCount,
  listedShippedProjects,
  SHIPPED_ROLE_LABEL,
  type ShippedProject,
} from "@/entities/developer";
import { formatMonthYear } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = {
  /** Everything the developer shipped; confidential ones are never shown. */
  projects: ShippedProject[];
  /** The developer looking at their own portfolio is told how many are kept off it. */
  isOwner: boolean;
};

/**
 * "Shipped projects" on a portfolio (NN-17, prototype): client projects the
 * developer finished, added when the client gives final approval. Confidential
 * projects never appear. The entries are sample data, not this developer's.
 */
export function ShippedProjects({ projects, isOwner }: Props) {
  const listed = listedShippedProjects(projects);
  const hidden = hiddenConfidentialCount(projects);
  return (
    <Card aria-labelledby="shipped-projects-title" role="region">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <h2 id="shipped-projects-title">Shipped projects</h2>
          <PrototypeBadge />
        </CardTitle>
        <CardDescription>Sample entries. Client projects the developer finished on NextNode.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {listed.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <RocketIcon aria-hidden className="size-4" />
            {isOwner
              ? "No shipped projects yet. They appear here when a client gives final approval."
              : "No shipped projects yet."}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {listed.map((p) => (
              <li key={p.project_id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{p.title}</h3>
                  <Badge variant="secondary">{SHIPPED_ROLE_LABEL[p.role]}</Badge>
                </div>
                <p className="text-sm">{p.summary}</p>
                <p className="text-xs text-muted-foreground">
                  Shipped <time dateTime={p.shipped_at}>{formatMonthYear(p.shipped_at)}</time>
                </p>
                <ul aria-label="Tech stack" className="flex flex-wrap gap-1">
                  {p.tech_stack.map((s) => (
                    <li key={s.key}>
                      <Badge variant="outline">{s.label}</Badge>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {isOwner && hidden > 0 ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <EyeOffIcon aria-hidden className="mt-px size-3.5 shrink-0" />
            {hidden === 1
              ? "1 confidential project is kept off your portfolio. Only you see this note."
              : `${hidden} confidential projects are kept off your portfolio. Only you see this note.`}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
