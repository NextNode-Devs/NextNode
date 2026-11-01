"use client";

import { DownloadIcon, FileTextIcon, Loader2Icon, LockIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { getDocumentLink, listDocuments, type RequirementDocument } from "@/entities/project";
import { UploadRequirementDoc } from "@/features/upload-requirement-doc";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { formatMessageTime } from "@/shared/lib/format-date";
import { Button } from "@/shared/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";
import { Skeleton } from "@/shared/ui/shadcn/skeleton";

type Props = {
  projectId: number;
  canUpload: boolean;
  /** Injected in tests. */
  api?: BrowserApi;
};

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; documents: RequirementDocument[] };

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A client project's private requirement documents, for its readers only
 * (the owning client, the Team Lead and approved members). */
export function RequirementDocuments({ projectId, canUpload, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listDocuments(api, projectId).then((result) => {
      if (!live) return;
      setLoad(result.ok ? { state: "ready", documents: result.data } : { state: "error", message: result.error.message });
    });
    return () => {
      live = false;
    };
  }, [api, projectId, attempt]);

  const download = async (document: RequirementDocument) => {
    setDownloadError(null);
    setDownloading(document.id);
    // A fresh link per click: links expire after 15 minutes and re-check access.
    const link = await getDocumentLink(api, projectId, document.id);
    setDownloading(null);
    if (!link.ok) return setDownloadError(`${document.filename}: ${link.error.message}`);
    window.location.assign(link.data.url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <h2>Requirement documents</h2>
        </CardTitle>
        <CardDescription className="flex items-start gap-1.5">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Private: only the client, the Team Lead and team members can see these. Applicants can&apos;t.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {load.state === "loading" ? (
          <div role="status" aria-label="Loading documents" className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : load.state === "error" ? (
          <div role="alert" className="space-y-2 text-sm">
            <p className="text-destructive">We couldn&apos;t load the documents. {load.message}</p>
            <Button size="sm" variant="outline" onClick={() => { setLoad({ state: "loading" }); setAttempt((n) => n + 1); }}>
              Try again
            </Button>
          </div>
        ) : load.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canUpload
              ? "No documents yet. Add the requirements your Team Lead will need: specs, wireframes, contracts."
              : "The client hasn't added any documents yet."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {load.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{document.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {document.type.toUpperCase()} · {size(document.size_bytes)}
                      {document.uploaded_at ? ` · ${formatMessageTime(document.uploaded_at)}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={downloading !== null}
                  onClick={() => void download(document)}
                  aria-label={`Download ${document.filename}`}
                >
                  {downloading === document.id ? (
                    <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <DownloadIcon aria-hidden />
                  )}
                  Download
                </Button>
              </li>
            ))}
          </ul>
        )}
        {downloadError ? (
          <p role="alert" className="text-sm text-destructive">
            {downloadError}
          </p>
        ) : null}
        {canUpload && load.state === "ready" ? (
          <UploadRequirementDoc
            projectId={projectId}
            count={load.documents.length}
            api={injected}
            onUploaded={(document) =>
              setLoad((current) =>
                current.state === "ready" ? { state: "ready", documents: [...current.documents, document] } : current,
              )
            }
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
