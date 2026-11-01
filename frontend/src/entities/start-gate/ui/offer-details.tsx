import { formatCalendarDate, formatMessageTime } from "@/shared/lib/format-date";
import { formatMoney } from "@/shared/lib/format-money";
import { Badge } from "@/shared/ui/shadcn/badge";

import { OFFER_STATUS_LABEL, type Offer } from "../model/start-gate";

type Props = {
  offer: Offer;
  /** The client's listing budget, shown next to the total because it was only a proposal. */
  proposedBudgetCents: number | null;
};

/** One signed version of the offer: its terms, its signature and the client's decision, read-only. */
export function OfferDetails({ offer, proposedBudgetCents }: Props) {
  const money = (cents: number) => formatMoney(cents, offer.currency);
  return (
    <article aria-labelledby={`offer-${offer.id}`} className="space-y-3 rounded-lg border p-4 text-sm">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`offer-${offer.id}`} className="font-medium">
          Offer version {offer.version}
        </h3>
        <Badge
          variant={offer.status === "declined" ? "outline" : offer.status === "accepted" ? "default" : "secondary"}
        >
          {OFFER_STATUS_LABEL[offer.status]}
        </Badge>
      </header>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Offer total</dt>
          <dd className="text-lg font-semibold tracking-tight">{money(offer.total_cents)}</dd>
          {proposedBudgetCents !== null ? (
            <dd className="text-xs text-muted-foreground">
              Client&apos;s proposed budget: {money(proposedBudgetCents)}
            </dd>
          ) : null}
        </div>
        <div>
          <dt className="text-muted-foreground">Deposit due at project start</dt>
          <dd className="text-lg font-semibold tracking-tight">{money(offer.deposit_cents)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Start</dt>
          <dd className="font-medium">{formatCalendarDate(offer.start_date)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Delivery</dt>
          <dd className="font-medium">{formatCalendarDate(offer.delivery_date)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Estimate</dt>
          <dd className="whitespace-pre-line">{offer.summary}</dd>
        </div>
      </dl>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>
          Signed by {offer.signed_by.display_name} (Team Lead), {formatMessageTime(offer.signed_at)}
        </li>
        {offer.decided_by && offer.decided_at ? (
          <li>
            {offer.status === "accepted" ? "Accepted" : "Declined"} by {offer.decided_by.display_name},{" "}
            {formatMessageTime(offer.decided_at)}
          </li>
        ) : null}
      </ul>
      {offer.decline_reason ? (
        <p className="rounded-md bg-muted p-3">
          <span className="font-medium">Reason: </span>
          {offer.decline_reason}
        </p>
      ) : null}
    </article>
  );
}
