"use client";

import { EMPTY_DRAFT, ProjectForm } from "@/entities/project";
import { SkillsInput } from "@/entities/skill";

import { postBrief } from "../api/post-brief";

/** The client's brief: scope, tech stack, target date and a proposed budget. */
export function PostBriefForm({ submit = postBrief }: { submit?: typeof postBrief }) {
  return (
    <ProjectForm
      kind="client"
      initial={EMPTY_DRAFT}
      submit={submit}
      renderTechStack={(props) => <SkillsInput {...props} placeholder="e.g. React" />}
      submitLabel="Publish brief"
      pendingLabel="Publishing…"
      failureTitle="Your brief wasn't published"
      cancelHref="/dashboard"
    />
  );
}
