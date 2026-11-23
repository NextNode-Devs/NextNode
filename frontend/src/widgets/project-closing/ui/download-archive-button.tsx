"use client";

import { DownloadIcon } from "lucide-react";

import { underConstruction } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/shadcn/button";

/** Download the project's files and conversation history (prototype). */
export function DownloadArchiveButton() {
  return (
    <Button type="button" variant="outline" className="w-full" onClick={() => underConstruction("Download the project archive")}>
      <DownloadIcon aria-hidden data-icon="inline-start" />
      Download the project archive
    </Button>
  );
}
