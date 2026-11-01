import { InfoIcon } from "lucide-react";

/** Said wherever an offer is signed or accepted (spec: agreement is not a legal contract). */
export function AgreementNote() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        This is an in-app acknowledgement for a student prototype, not a legal contract, and it hasn&apos;t been legally
        reviewed. NextNode records the version, who signed or accepted it, and when.
      </span>
    </p>
  );
}
