"use server";

import { redirect } from "next/navigation";

import { projectHref, saveFailureFrom, toRequestBody, type Project, type ProjectDraft, type SaveFailure } from "@/entities/project";
import { apiPost } from "@/shared/api/server-client";

/** A developer publishes an idea and becomes its Team Lead, then lands on it.
 * Only developers can: the API answers 403 to a client. No budget is sent. */
export async function proposeIdea(draft: ProjectDraft): Promise<SaveFailure> {
  const result = await apiPost<Project>("/api/project-ideas/", toRequestBody("developer", draft), {
    auth: true,
    timeoutMs: 8000,
  });
  if (!result.ok) return saveFailureFrom(result.error);
  redirect(`${projectHref(result.data.id)}?created=1`); // throws to navigate; keep outside any try
}
