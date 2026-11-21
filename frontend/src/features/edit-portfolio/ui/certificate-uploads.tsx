"use client";

import {
  FileTextIcon,
  Loader2Icon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { useId, useRef, useState } from "react";

import {
  CERTIFICATE_LIMITS,
  deleteCertificate,
  uploadCertificate,
  type PortfolioCertificate,
} from "@/entities/developer";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";

type Props = {
  certificates: PortfolioCertificate[];
  onChange: (certificates: PortfolioCertificate[]) => void;
  /** Injected in tests. */
  api?: BrowserApi;
};

const MB = 1024 * 1024;

/** Quick checks before uploading; the backend checks the file's bytes as well. */
export function checkCertificate(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return "Certificates must be PDF files (.pdf).";
  if (file.size === 0) return "This file is empty.";
  if (file.size > CERTIFICATE_LIMITS.maxBytes) {
    return `Certificates can be at most ${CERTIFICATE_LIMITS.maxBytes / MB} MB; this one is ${(file.size / MB).toFixed(1)} MB.`;
  }
  return null;
}

/**
 * Upload PDF certificates from the computer (NN-34). Each upload and removal is
 * saved straight away, separately from the "Save portfolio" button.
 */
export function CertificateUploads({
  certificates,
  onChange,
  api: injected,
}: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const full = certificates.length >= CERTIFICATE_LIMITS.maxFiles;
  const busy = Boolean(uploading || removing);

  const upload = async (file: File) => {
    setDone(null);
    const problem = checkCertificate(file);
    if (input.current) input.current.value = "";
    if (problem) return setError(problem);
    setError(null);
    setUploading(file.name);
    const result = await uploadCertificate(api, file);
    setUploading(null);
    if (!result.ok)
      return setError(result.error.fields?.file?.[0] ?? result.error.message);
    setDone(`${result.data.filename} uploaded.`);
    onChange([...certificates, result.data]);
  };

  const remove = async (certificate: PortfolioCertificate) => {
    setDone(null);
    setError(null);
    setRemoving(certificate.id);
    const result = await deleteCertificate(api, certificate.id);
    setRemoving(null);
    if (!result.ok) return setError(result.error.message);
    setDone(`${certificate.filename} removed.`);
    onChange(certificates.filter((c) => c.id !== certificate.id));
  };

  return (
    <div className="space-y-3">
      {certificates.length ? (
        <ul aria-label="Your certificates" className="space-y-2">
          {certificates.map((certificate) => (
            <li
              key={certificate.id}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <FileTextIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">
                {certificate.filename}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void remove(certificate)}
                aria-label={`Remove ${certificate.filename}`}
              >
                {removing === certificate.id ? (
                  <Loader2Icon
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                ) : (
                  <Trash2Icon aria-hidden />
                )}
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No certificates uploaded yet.
        </p>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        accept={CERTIFICATE_LIMITS.accept}
        className="sr-only"
        disabled={busy || full}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        aria-invalid={Boolean(error)}
        aria-label="Choose a PDF certificate"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy || full}
        onClick={() => input.current?.click()}
      >
        {uploading ? (
          <Loader2Icon
            className="animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        ) : (
          <UploadIcon aria-hidden />
        )}
        {uploading ? `Uploading ${uploading}…` : "Upload certificate"}
      </Button>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {full
          ? `You have the maximum of ${CERTIFICATE_LIMITS.maxFiles} certificates. Remove one to add another.`
          : `Eligible format: PDF only (.pdf). Up to ${CERTIFICATE_LIMITS.maxBytes / MB} MB each, ${CERTIFICATE_LIMITS.maxFiles} certificates at most. Uploads are saved straight away.`}
      </p>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="text-sm text-success">
          {done}
        </p>
      ) : null}
    </div>
  );
}
