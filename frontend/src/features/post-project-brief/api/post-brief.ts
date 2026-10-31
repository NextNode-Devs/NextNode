"use server";

import { redirect } from "next/navigation";

import { projectHref, saveFailureFrom, toRequestBody, type Project, type ProjectDraft, type SaveFailure } from "@/entities/project";
import { apiPost } from "@/shared/api/server-client";

/** A client publishes a brief, then lands on it with a confirmation. Only
 * clients can: the API answers 403 to a developer. */
export async function postBrief(draft: ProjectDraft): Promise<SaveFailure> {
  const result = await apiPost<Project>("/api/projects/", toRequestBody("client", draft), { auth: true, timeoutMs: 8000 });
  if (!result.ok) return saveFailureFrom(result.error);
  redirect(`${projectHref(result.data.id)}?created=1`); // throws to navigate; keep outside any try
}
