"use client";

import { EMPTY_DRAFT, ProjectForm } from "@/entities/project";
import { SkillsInput } from "@/entities/skill";

import { proposeIdea } from "../api/propose-idea";

/** A developer's own project idea. No budget: ideas never have payments. */
export function ProposeIdeaForm({ submit = proposeIdea }: { submit?: typeof proposeIdea }) {
  return (
    <ProjectForm
      kind="developer"
      initial={EMPTY_DRAFT}
      submit={submit}
      renderTechStack={(props) => <SkillsInput {...props} placeholder="e.g. Next.js" />}
      submitLabel="Publish idea"
      pendingLabel="Publishing…"
      failureTitle="Your idea wasn't published"
      cancelHref="/dashboard"
    />
  );
}
