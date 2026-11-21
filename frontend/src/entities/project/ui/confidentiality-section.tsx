"use client";

import { useState } from "react";

import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Label } from "@/shared/ui/shadcn/label";
import { Switch } from "@/shared/ui/shadcn/switch";

import { LegalTerms } from "./legal-terms";

/**
 * PROTOTYPE (Phase 2, #93): the "Confidential" switch on a client brief and
 * the "To be defined" legal panel. The switch is NOT sent with the brief (the
 * API has no `confidential` field yet), and its hint says so, so publishing
 * and editing work exactly as in Phase 1.
 */
export function ConfidentialitySection() {
  const [confidential, setConfidential] = useState(false);
  return (
    <section aria-labelledby="confidentiality-heading" className="space-y-4 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="confidentiality-heading" className="text-base font-semibold">
          Confidentiality
        </h2>
        <PrototypeBadge />
      </div>
      <div className="flex items-start gap-3">
        <Switch
          id="confidential"
          className="mt-0.5"
          checked={confidential}
          onCheckedChange={setConfidential}
          aria-describedby="confidential-hint"
        />
        <div className="space-y-1">
          <Label htmlFor="confidential">Confidential project</Label>
          <p id="confidential-hint" className="text-xs text-muted-foreground">
            Keeps this project out of the team&apos;s portfolios after it ships. Not saved yet: this is a prototype.
          </p>
        </div>
      </div>
      <div role="group" aria-labelledby="legal-terms-heading" className="space-y-3 rounded-xl border bg-muted/40 p-4">
        <p id="legal-terms-heading" className="text-sm font-semibold">
          Ownership and confidentiality terms
        </p>
        <LegalTerms confidential={confidential} />
      </div>
    </section>
  );
}
