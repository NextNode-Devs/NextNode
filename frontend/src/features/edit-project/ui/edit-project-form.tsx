"use client";

import { draftFrom, ProjectForm, projectHref, type Project } from "@/entities/project";
import { SkillsInput } from "@/entities/skill";

import { editProject } from "../api/edit-project";

type Props = { project: Project; submit?: typeof editProject };

export function EditProjectForm({ project, submit = editProject }: Props) {
  return (
    <ProjectForm
      kind={project.kind}
      initial={draftFrom(project)}
      submit={(draft) => submit(project.id, project.kind, draft)}
      renderTechStack={(props) => <SkillsInput {...props} />}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      failureTitle="Your changes weren't saved"
      cancelHref={projectHref(project.id)}
    />
  );
}
