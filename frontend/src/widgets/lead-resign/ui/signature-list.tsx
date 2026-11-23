import { CheckIcon, Clock3Icon } from "lucide-react";

import type { LeadSignature } from "@/entities/team";
import { formatMessageTime } from "@/shared/lib/format-date";
import { cn } from "@/shared/lib/utils";

/** The Lead signatures on the offer: the original Lead's, then the new Lead's (planned co-signature). */
export function SignatureList({ signatures, youId }: { signatures: LeadSignature[]; youId: number | null }) {
  return (
    <ul aria-label="Team Lead signatures" className="space-y-2 text-sm">
      {signatures.map((signature) => {
        const signed = signature.signed_at !== null;
        const you = signature.lead.account_id === youId;
        const Icon = signed ? CheckIcon : Clock3Icon;
        return (
          <li key={`${signature.kind}-${signature.lead.account_id}`} className="flex items-start gap-2">
            <Icon className={cn("mt-0.5 size-4 shrink-0", signed ? "text-success" : "text-warning")} aria-hidden />
            <span className="min-w-0">
              <span className="font-medium">
                {signature.lead.display_name}
                {you ? " (you)" : ""}
              </span>
              <span className="text-muted-foreground">
                {" · "}
                {signature.kind === "original" ? "original Team Lead" : "new Team Lead"}
                {" · "}
                {signed ? `signed ${formatMessageTime(signature.signed_at)}` : "signature needed"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
