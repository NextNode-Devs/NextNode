"use client";

import { DownloadIcon, FileTextIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getCertificateFile,
  type PortfolioCertificate,
} from "@/entities/developer";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { MotionDialog } from "@/shared/ui/organisms/motion-dialog";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  accountId: number;
  certificates: PortfolioCertificate[];
  /** Injected in tests. */
  api?: BrowserApi;
};

type Preview =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

/**
 * A developer's certificates on their portfolio (NN-34). Each opens a preview
 * of the PDF in a pop-up over the page, with a close button at the top right.
 */
export function CertificateList({
  accountId,
  certificates,
  api: injected,
}: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const [open, setOpen] = useState<PortfolioCertificate | null>(null);
  const [preview, setPreview] = useState<Preview>({ status: "loading" });

  useEffect(() => {
    if (!open) return;
    let url: string | null = null;
    let cancelled = false;
    void getCertificateFile(api, accountId, open.id).then((result) => {
      if (cancelled) return;
      if (!result.ok)
        return setPreview({ status: "error", message: result.error.message });
      url = URL.createObjectURL(result.data);
      setPreview({ status: "ready", url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url); // the file stays in memory only while it's shown
    };
  }, [api, accountId, open]);

  return (
    <section aria-labelledby="certificates-title" className="space-y-2">
      <h3 id="certificates-title" className="text-sm font-medium">
        Certificates
      </h3>
      {certificates.length ? (
        <ul className="space-y-1 text-sm">
          {certificates.map((certificate) => (
            <li key={certificate.id}>
              <button
                type="button"
                onClick={() => {
                  setPreview({ status: "loading" });
                  setOpen(certificate);
                }}
                className="inline-flex max-w-full items-center gap-1.5 rounded-sm text-left font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <FileTextIcon className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{certificate.filename}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No certificates added.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Certificates are shown as provided; NextNode doesn&apos;t verify them.
      </p>

      <MotionDialog
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        title={open?.filename ?? "Certificate"}
        className="flex h-[85vh] max-w-4xl flex-col"
        footer={
          preview.status === "ready" && open ? (
            <Button asChild variant="outline">
              <a href={preview.url} download={open.filename}>
                <DownloadIcon aria-hidden /> Download
              </a>
            </Button>
          ) : null
        }
      >
        {preview.status === "loading" ? (
          <p
            role="status"
            className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2Icon
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />{" "}
            Loading the certificate…
          </p>
        ) : preview.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            We couldn&apos;t open this certificate. {preview.message}
          </p>
        ) : (
          <iframe
            src={preview.url}
            title={`Preview of ${open?.filename ?? "the certificate"}`}
            className="min-h-0 w-full flex-1 rounded-lg border bg-muted"
          />
        )}
      </MotionDialog>
    </section>
  );
}
