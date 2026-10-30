/** Mirrors the backend envelope: `{ data }` on success, `{ error }` on failure. */
export type ApiError = { code: string; message: string; fields?: Record<string, string[]> };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH";

/** Turns a fetch outcome into an `ApiResult`. Shared by the server and browser clients. */
export async function readEnvelope<T>(response: Response): Promise<ApiResult<T>> {
  const body = (await response.json().catch(() => null)) as { data: T } | { error: ApiError } | null;
  if (response.ok && body && "data" in body) return { ok: true, data: body.data };
  if (body && "error" in body) return { ok: false, error: body.error };
  return {
    ok: false,
    error: { code: "BAD_RESPONSE", message: `The API answered ${response.status} without a readable body.` },
  };
}

export const UNREACHABLE: ApiError = { code: "UNREACHABLE", message: "The API could not be reached." };
