"use client";

import { Loader2Icon, UploadIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { PROJECT_LIMITS, type RequirementDocument } from "@/entities/project";
import { useApiClient, type BrowserApi } from "@/shared/api/browser-client";
import { Button } from "@/shared/ui/shadcn/button";

import { checkFile } from "../model/check-file";

type Props = {
  projectId: number;
  /** How many documents the project has, for the count limit. */
  count: number;
  onUploaded: (document: RequirementDocument) => void;
  /** Injected in tests. */
  api?: BrowserApi;
};

/** The owning client adds a PDF or DOCX to its project (private: owner, Team Lead and members only). */
export function UploadRequirementDoc({ projectId, count, onUploaded, api: injected }: Props) {
  const browserApi = useApiClient();
  const api = injected ?? browserApi;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const full = count >= PROJECT_LIMITS.documents;

  const upload = async (file: File) => {
    setDone(null);
    const problem = checkFile(file);
    if (problem) return setError(problem);
    setError(null);
    setUploading(file.name);
    const form = new FormData();
    form.append("file", file);
    const result = await api.postForm<RequirementDocument>(`/api/projects/${projectId}/documents/`, form);
    setUploading(null);
    if (input.current) input.current.value = "";
    if (!result.ok) {
      setError(result.error.fields?.file?.[0] ?? result.error.message);
      return;
    }
    setDone(`${result.data.filename} uploaded.`);
    onUploaded(result.data);
  };

  return (
    <div className="space-y-2">
      <input
        ref={input}
        id={id}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        disabled={Boolean(uploading) || full}
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button type="button" variant="outline" disabled={Boolean(uploading) || full} onClick={() => input.current?.click()}>
        {uploading ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : <UploadIcon aria-hidden />}
        {uploading ? `Uploading ${uploading}…` : "Upload document"}
      </Button>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {full
          ? `This project has the maximum of ${PROJECT_LIMITS.documents} documents.`
          : `PDF or DOCX, up to ${PROJECT_LIMITS.documentBytes / (1024 * 1024)} MB each, ${PROJECT_LIMITS.documents} per project.`}
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
