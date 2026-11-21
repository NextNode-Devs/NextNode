import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import type { PortfolioCertificate } from "../model/certificate";

type ApiGetter = { get<T>(path: string): Promise<ApiResult<T>> };

const MINE = "/api/developers/me/certificates/";

export function getCertificates(
  api: ApiGetter,
  accountId: number,
): Promise<ApiResult<PortfolioCertificate[]>> {
  return api.get<PortfolioCertificate[]>(
    `/api/developers/${accountId}/certificates/`,
  );
}

/** Uploads one PDF to the signed-in developer's portfolio. */
export function uploadCertificate(
  api: BrowserApi,
  file: File,
): Promise<ApiResult<PortfolioCertificate>> {
  const form = new FormData();
  form.append("file", file);
  return api.postForm<PortfolioCertificate>(MINE, form);
}

export function deleteCertificate(
  api: BrowserApi,
  id: string,
): Promise<ApiResult<PortfolioCertificate>> {
  return api.delete<PortfolioCertificate>(`${MINE}${id}/`);
}

/** The PDF itself, fetched with the session token for the preview. */
export function getCertificateFile(
  api: BrowserApi,
  accountId: number,
  id: string,
): Promise<ApiResult<Blob>> {
  return api.getBlob(`/api/developers/${accountId}/certificates/${id}/file/`);
}
