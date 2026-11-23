import { QuoteIcon } from "lucide-react";

import type { TeamLeadReference } from "@/entities/rating";
import { formatMonthYear } from "@/shared/lib/format-date";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

type Props = { references: TeamLeadReference[]; isOwner: boolean };

/**
 * "Team Lead reference" on a member's portfolio (NN-35, prototype): what
 * their Team Leads wrote when rating them after a completed project. The
 * entries are sample data, not this developer's.
 */
export function TeamLeadReferences({ references, isOwner }: Props) {
  return (
    <Card aria-labelledby="lead-references-title" role="region">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <h2 id="lead-references-title">Team Lead references</h2>
          <PrototypeBadge />
        </CardTitle>
        <CardDescription>Sample entries. Written by Team Leads after a completed project.</CardDescription>
      </CardHeader>
      <CardContent>
        {references.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "No references yet. Your Team Lead can write one when they rate you after a project."
              : "No Team Lead references yet."}
          </p>
        ) : (
          <ul className="space-y-4">
            {references.map((r) => (
              <li key={r.id}>
                <figure className="space-y-1.5">
                  <blockquote className="flex gap-2 text-sm">
                    <QuoteIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p>{r.body}</p>
                  </blockquote>
                  <figcaption className="pl-6 text-xs text-muted-foreground">
                    {r.lead_name}, Team Lead on {r.project_title} ·{" "}
                    <time dateTime={r.written_at}>{formatMonthYear(r.written_at)}</time>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
