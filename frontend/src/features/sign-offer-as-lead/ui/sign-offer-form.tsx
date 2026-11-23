"use client";

import { PenLineIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { underConstruction } from "@/shared/lib/toast";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Alert, AlertDescription } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Checkbox } from "@/shared/ui/shadcn/checkbox";
import { Label } from "@/shared/ui/shadcn/label";

type Props = {
  version: number;
  /** The Lead being replaced, who loses access once this is signed. */
  outgoingLead: string;
};

/**
 * The approved new Lead signs the offer version the client already accepted
 * (NN-38, prototype). They confirm they read it first; signing and stepping
 * back are under construction and save nothing.
 */
export function SignOfferForm({ version, outgoingLead }: Props) {
  const id = useId();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!agreed) {
      setError(`Confirm you've read version ${version} before you sign.`);
      return;
    }
    setError(null);
    underConstruction(`Signing offer version ${version} as Team Lead`);
  };

  const stepBack = () => {
    setDeclineOpen(false);
    underConstruction("Stepping back from leading");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`${id}-agree`}
          checked={agreed}
          onCheckedChange={(value) => {
            setAgreed(value === true);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5"
        />
        <Label htmlFor={`${id}-agree`} className="leading-snug font-normal">
          I&apos;ve read offer version {version} and I&apos;ll lead the team on these terms.
        </Label>
      </div>
      {error ? (
        <Alert variant="destructive" role="alert" id={`${id}-error`}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit">
          <PenLineIcon aria-hidden />
          Sign version {version}
        </Button>
        <MotionDialog
          open={declineOpen}
          onOpenChange={setDeclineOpen}
          title="Step back from leading?"
          description={`The team and the client are told. The team can propose another member, and the client approves them. ${outgoingLead} doesn't come back as Lead.`}
          trigger={
            <Button type="button" variant="outline">
              I can&apos;t lead this
            </Button>
          }
          footer={
            <>
              <Button variant="outline" onClick={() => setDeclineOpen(false)}>
                Keep going
              </Button>
              <Button variant="destructive" onClick={stepBack}>
                Step back
              </Button>
            </>
          }
        />
      </div>
    </form>
  );
}
