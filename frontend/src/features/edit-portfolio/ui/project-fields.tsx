"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { PORTFOLIO_LIMITS } from "@/entities/developer";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";

import type { FieldErrors, ProjectDraft } from "../model/draft";

type Props = {
  projects: ProjectDraft[];
  errors: FieldErrors;
  onChange: (index: number, field: keyof Omit<ProjectDraft, "key">, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

/** Up to six projects, each a title, a repository link and an optional live demo. */
export function ProjectFields({ projects, errors, onChange, onAdd, onRemove }: Props) {
  const full = projects.length >= PORTFOLIO_LIMITS.projects;
  return (
    <div className="space-y-4">
      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No projects yet. Add one to show clients what you&apos;ve built.
        </p>
      ) : (
        <ol className="space-y-4">
          {projects.map((project, index) => {
            const base = `projects-${index}`;
            const path = `projects.${index}`;
            const name = project.title.trim() || `Project ${index + 1}`;
            return (
              <li key={project.key} className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium">Project {index + 1}</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(index)}>
                    <Trash2Icon aria-hidden /> Remove <span className="sr-only">{name}</span>
                  </Button>
                </div>
                <FormField id={`${base}-title`} label="Title" required error={errors[`${path}.title`]}>
                  {(aria) => (
                    <Input
                      {...aria}
                      required
                      value={project.title}
                      maxLength={PORTFOLIO_LIMITS.projectTitle}
                      onChange={(event) => onChange(index, "title", event.target.value)}
                    />
                  )}
                </FormField>
                <FormField
                  id={`${base}-repository`}
                  label="Repository link"
                  required
                  error={errors[`${path}.repository_url`]}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      type="url"
                      inputMode="url"
                      required
                      placeholder="https://github.com/you/project"
                      value={project.repository_url}
                      maxLength={PORTFOLIO_LIMITS.url}
                      onChange={(event) => onChange(index, "repository_url", event.target.value)}
                    />
                  )}
                </FormField>
                <FormField id={`${base}-demo`} label="Live demo link" error={errors[`${path}.demo_url`]}>
                  {(aria) => (
                    <Input
                      {...aria}
                      type="url"
                      inputMode="url"
                      placeholder="https://project.example.com"
                      value={project.demo_url}
                      maxLength={PORTFOLIO_LIMITS.url}
                      onChange={(event) => onChange(index, "demo_url", event.target.value)}
                    />
                  )}
                </FormField>
              </li>
            );
          })}
        </ol>
      )}
      {errors.projects ? <p className="text-sm text-destructive">{errors.projects}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={onAdd} disabled={full}>
          <PlusIcon aria-hidden /> Add a project
        </Button>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {full
            ? `That's the most you can add (${PORTFOLIO_LIMITS.projects}). Remove one to add another.`
            : `${projects.length} of ${PORTFOLIO_LIMITS.projects} projects.`}
        </p>
      </div>
    </div>
  );
}
