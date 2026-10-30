import { formatMoney } from "@/shared/lib/format-money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import { canPayDeposit, type DepositViewer } from "../model/can-pay-deposit";
import { PayDepositButton } from "./pay-deposit-button";
import { TestModeNote } from "./test-mode-note";

type Props = DepositViewer & {
  projectId: string;
  /** Server-computed by #7's `deposit_for`; the browser never computes it. */
  depositCents: number;
  offerTotalCents: number;
  depositPercent: number;
  currency: string;
};

/**
 * The client's deposit step on a project page (#3/#6 render it). Renders
 * nothing for anyone who cannot pay, so no one sees a control they can't use.
 */
export function PayDepositCard(props: Props) {
  if (!canPayDeposit(props)) return null;
  const { projectId, depositCents, offerTotalCents, depositPercent, currency } = props;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay the deposit to start your project</CardTitle>
        <CardDescription>
          Your team starts work once Stripe confirms the deposit. Paying twice is not possible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <dl className="space-y-1">
          <dt className="text-sm text-muted-foreground">Deposit due</dt>
          <dd className="text-2xl font-semibold tracking-tight">{formatMoney(depositCents, currency)}</dd>
          <dd className="text-sm text-muted-foreground">
            {depositPercent} % of the accepted offer ({formatMoney(offerTotalCents, currency)})
          </dd>
        </dl>
        <TestModeNote />
        <PayDepositButton projectId={projectId} />
      </CardContent>
    </Card>
  );
}
