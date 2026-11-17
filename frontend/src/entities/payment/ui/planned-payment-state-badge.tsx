import { Badge } from "@/shared/ui/shadcn/badge";

import { PLANNED_PAYMENT_STATE_LABEL, type PlannedPaymentState } from "../model/planned-payment";

const VARIANT: Record<PlannedPaymentState, "outline" | "secondary" | "default"> = {
  due: "outline",
  held: "secondary",
  released: "default",
  refunded: "outline",
};

/** A planned payment's state, in words (never colour alone). */
export function PlannedPaymentStateBadge({ state }: { state: PlannedPaymentState }) {
  return <Badge variant={VARIANT[state]}>{PLANNED_PAYMENT_STATE_LABEL[state]}</Badge>;
}
