import { TriangleAlertIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

/**
 * PROTOTYPE (Phase 2, #93). Code ownership and confidentiality need legal
 * research, so every term reads "To be defined" (phase-2 product decisions,
 * "Legal wording"). Nothing here may invent a legal term.
 */
const TERMS = ["Code ownership after final payment", "Confidentiality terms"] as const;

type Props = {
  /** Adds the one rule we do know: confidential projects stay out of portfolios. */
  confidential?: boolean;
  /** Two columns from `sm` up (the brief form), or one term per row (a side column). */
  layout?: "columns" | "stacked";
};

/** The terms and the legal-review warning. */
export function LegalTerms({ confidential = false, layout = "columns" }: Props) {
  const columns = layout === "columns";
  return (
    <div className="space-y-3">
      <dl className={cn("grid gap-3", columns && "sm:grid-cols-2")}>
        {TERMS.map((term) => (
          <div key={term}>
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className="text-sm font-medium">To be defined</dd>
          </div>
        ))}
        {confidential ? (
          <div className={cn(columns && "sm:col-span-2")}>
            <dt className="text-xs text-muted-foreground">Portfolios</dt>
            <dd className="text-sm font-medium">Kept out of the team&apos;s portfolios</dd>
          </div>
        ) : null}
      </dl>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
        These terms need legal review.
      </p>
    </div>
  );
}

/**
 * Read-only card on a client project's page (#93). Projects don't store
 * `confidential` yet, so it shows the open terms only.
 */
export function LegalTermsCard() {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">
          <h2>Ownership and confidentiality</h2>
        </CardTitle>
        <PrototypeBadge />
      </CardHeader>
      <CardContent>
        <LegalTerms layout="stacked" />
      </CardContent>
    </Card>
  );
}
