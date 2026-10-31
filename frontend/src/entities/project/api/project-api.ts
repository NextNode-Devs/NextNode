import type { ApiResult } from "@/shared/api/types";

import { projectQuery, type ProjectFilters } from "../lib/project-params";
import type { MyProject, Project, ProjectPage, RequirementDocument } from "../model/project";

/** Any client that can GET: the browser client, or a server-side wrapper of `apiGet`. */
export type ApiGetter = { get<T>(path: string): Promise<ApiResult<T>> };

export function getProject(api: ApiGetter, id: number): Promise<ApiResult<Project>> {
  return api.get<Project>(`/api/projects/${id}/`);
}

export function searchProjects(api: ApiGetter, filters: ProjectFilters): Promise<ApiResult<ProjectPage>> {
  return api.get<ProjectPage>(`/api/projects/${projectQuery(filters)}`);
}

export function getMyProjects(api: ApiGetter): Promise<ApiResult<MyProject[]>> {
  return api.get<MyProject[]>("/api/projects/mine/");
}

export function listDocuments(api: ApiGetter, projectId: number): Promise<ApiResult<RequirementDocument[]>> {
  return api.get<RequirementDocument[]>(`/api/projects/${projectId}/documents/`);
}

/** A download URL for the signed-in reader, valid for 15 minutes. */
export function getDocumentLink(
  api: ApiGetter,
  projectId: number,
  documentId: string,
): Promise<ApiResult<{ url: string; expires_at: string }>> {
  return api.get(`/api/projects/${projectId}/documents/${documentId}/link/`);
}
