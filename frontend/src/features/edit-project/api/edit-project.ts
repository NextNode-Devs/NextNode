"use server";

import { redirect } from "next/navigation";

import {
  projectHref,
  saveFailureFrom,
  toRequestBody,
  type Project,
  type ProjectDraft,
  type ProjectKind,
  type SaveFailure,
} from "@/entities/project";
import { apiPatch } from "@/shared/api/server-client";

/** The owner saves the project while it may still be edited; the API answers
 * 403 to anyone else and 409 (with the reason) once a Lead is hired. */
export async function editProject(id: number, kind: ProjectKind, draft: ProjectDraft): Promise<SaveFailure> {
  const result = await apiPatch<Project>(`/api/projects/${id}/`, toRequestBody(kind, draft), {
    auth: true,
    timeoutMs: 8000,
  });
  if (!result.ok) return saveFailureFrom(result.error);
  redirect(`${projectHref(result.data.id)}?saved=1`); // throws to navigate; keep outside any try
}
