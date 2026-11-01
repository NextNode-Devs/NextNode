import type { ReactNode } from "react";

import { OfferDetails, type Offer } from "@/entities/start-gate";

type Props = {
  offers: Offer[]; // newest first
  proposedBudgetCents: number | null;
  /** Rendered under the newest version (the client's accept/decline). */
  children?: ReactNode;
};

/** Every signed version, newest first. Earlier versions stay readable, unchanged, behind a disclosure. */
export function OfferHistory({ offers, proposedBudgetCents, children }: Props) {
  const [latest, ...earlier] = offers;
  if (!latest) return null;
  return (
    <section aria-labelledby="offer-history" className="space-y-3">
      <h3 id="offer-history" className="text-sm font-medium">
        Offer
      </h3>
      <OfferDetails offer={latest} proposedBudgetCents={proposedBudgetCents} />
      {children}
      {earlier.length > 0 ? (
        <details className="group rounded-lg text-sm">
          <summary className="cursor-pointer rounded-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            Earlier versions ({earlier.length})
          </summary>
          <div className="mt-3 space-y-3">
            {earlier.map((offer) => (
              <OfferDetails key={offer.id} offer={offer} proposedBudgetCents={proposedBudgetCents} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
