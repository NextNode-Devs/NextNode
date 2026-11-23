"use client";

import { FolderGit2Icon } from "lucide-react";

import { underConstruction } from "@/shared/lib/toast";
import { PrototypeBadge } from "@/shared/ui/molecules/prototype-badge";
import { Button } from "@/shared/ui/shadcn/button";

/**
 * "Import from GitHub" entry point on the portfolio form (NN-34, #102).
 * Prototype: the button only shows the under-construction toast. The real
 * version signs in with GitHub through Clerk and lets the developer pick
 * repositories to add as projects. Adding projects by hand keeps working.
 */
export function GithubImport() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Import from GitHub</p>
          <PrototypeBadge />
        </div>
        <p className="text-xs text-muted-foreground">
          Connect your GitHub account to pick repositories and add them here as projects. You can still add projects by
          hand below.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full shrink-0 sm:w-auto"
        onClick={() => underConstruction("Import from GitHub")}
      >
        <FolderGit2Icon aria-hidden data-icon="inline-start" />
        Import from GitHub
      </Button>
    </div>
  );
}
