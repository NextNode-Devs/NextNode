"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { closeDeveloperProject } from "@/entities/team";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";

type Props = {
  projectId: number;
  /** For tests; the page uses the signed-in browser client. */
  api?: BrowserApi;
};

/** The Team Lead or the Assistant Lead closes a developer project, after confirming (NN-39). */
export function CloseProjectButton({ projectId, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = async () => {
    setSending(true);
    setError(null);
    const result = await closeDeveloperProject(api, projectId);
    setSending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <MotionDialog
      open={open}
      onOpenChange={(next) => {
        if (!sending) setOpen(next);
      }}
      title="Close this project?"
      description="It leaves the open-projects feed and can't be reopened. Its chat and history stay."
      trigger={
        <Button variant="outline" size="sm">
          Close project
        </Button>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
            Keep it open
          </Button>
          <Button variant="destructive" onClick={close} disabled={sending}>
            {sending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {sending ? "Closing…" : "Close project"}
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </MotionDialog>
  );
}
